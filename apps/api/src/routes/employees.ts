// Empleados y enrolamiento facial (REQ-ENR, REQ-SEDE-02).
// El motor de visión valida CADA foto (exactamente 1 cara) antes de
// persistir el embedding; el promedio se calcula al finalizar.

import type { FastifyPluginAsync } from "fastify";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { EmployeeCreate, EmployeePatch, EnrollStatus, ENROLL_LIMITS } from "@recon/core";
import { l2Normalize } from "@recon/vision";
import { appUser, employee, faceSample, marking, site } from "../db/schema";
import type { Database } from "../db/client";
import { requireAdmin, requireAuth } from "../auth";
import { vision } from "../vision";
import { savePhoto } from "../storage";

export function employeeRoutes(db: Database): FastifyPluginAsync {
  return async (app) => {
    const auth = requireAuth(db);
    const admin = [requireAuth(db), requireAdmin];

    async function enrollStatus(employeeId: string) {
      const samples = await db
        .select()
        .from(faceSample)
        .where(and(eq(faceSample.employeeId, employeeId), eq(faceSample.active, true), eq(faceSample.kind, "single")));
      const validSamples = samples.length;
      return EnrollStatus.parse({
        employeeId,
        validSamples,
        minRequired: ENROLL_LIMITS.min,
        maxAllowed: ENROLL_LIMITS.max,
        canFinalize: validSamples >= ENROLL_LIMITS.min,
      });
    }

    async function enrolledIds(): Promise<Set<string>> {
      const rows = await db
        .select({ id: faceSample.employeeId })
        .from(faceSample)
        .where(and(eq(faceSample.kind, "average"), eq(faceSample.active, true)));
      return new Set(rows.map((r) => r.id));
    }

    function toEmployee(row: typeof employee.$inferSelect, enrolled: boolean) {
      return {
        id: row.id,
        fullName: row.fullName,
        docNumber: row.docNumber,
        siteId: row.siteId,
        shiftStart: row.shiftStart,
        shiftEnd: row.shiftEnd,
        active: row.active,
        faceEnrolled: enrolled,
        createdAt: row.createdAt.toISOString(),
      };
    }

    app.get("/employees", { preHandler: auth }, async () => {
      const rows = await db.select().from(employee).orderBy(employee.fullName);
      const enrolled = await enrolledIds();
      return rows.map((r) => toEmployee(r, enrolled.has(r.id)));
    });

    app.get("/employees/:id", { preHandler: auth }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const [row] = await db.select().from(employee).where(eq(employee.id, id));
      if (!row) return reply.code(404).send({ error: "empleado no encontrado" });
      const enrolled = await enrolledIds();
      return toEmployee(row, enrolled.has(row.id));
    });

    app.post("/employees", { preHandler: admin }, async (req, reply) => {
      const parsed = EmployeeCreate.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "datos inválidos", issues: parsed.error.issues });
      }
      const [dupe] = await db.select().from(employee).where(eq(employee.docNumber, parsed.data.docNumber));
      if (dupe) return reply.code(409).send({ error: "DNI ya registrado" });
      const [created] = await db
        .insert(employee)
        .values({
          fullName: parsed.data.fullName,
          docNumber: parsed.data.docNumber,
          siteId: parsed.data.siteId,
          pinHash: parsed.data.pin ? await hash(parsed.data.pin) : null,
          shiftStart: parsed.data.shiftStart,
          shiftEnd: parsed.data.shiftEnd,
          consentAt: new Date(), // consentimiento explícito validado en el schema
        })
        .returning();
      return reply.code(201).send(toEmployee(created!, false));
    });

    app.patch("/employees/:id", { preHandler: admin }, async (req, reply) => {
      const parsed = EmployeePatch.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "datos inválidos", issues: parsed.error.issues });
      }
      const { id } = req.params as { id: string };
      const values: Partial<typeof employee.$inferInsert> = { ...parsed.data };
      if (parsed.data.pin === null) values.pinHash = null;
      else if (parsed.data.pin) values.pinHash = await hash(parsed.data.pin);
      delete (values as Record<string, unknown>).pin;

      const [row] = await db.update(employee).set(values).where(eq(employee.id, id)).returning();
      if (!row) return reply.code(404).send({ error: "empleado no encontrado" });
      const enrolled = await enrolledIds();
      return toEmployee(row, enrolled.has(row.id));
    });

    // Re-enrolamiento (REQ-ENR-03): desactiva todos los vectores; el
    // historial de marcajes NUNCA se toca.
    app.post("/employees/:id/face-samples/reset", { preHandler: admin }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const [row] = await db.select().from(employee).where(eq(employee.id, id));
      if (!row) return reply.code(404).send({ error: "empleado no encontrado" });
      await db.update(faceSample).set({ active: false }).where(eq(faceSample.employeeId, id));
      return enrollStatus(id);
    });

    // Carga de muestras: multipart con uno o más campos de archivo "photos".
    app.post("/employees/:id/face-samples", { preHandler: admin }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const [row] = await db.select().from(employee).where(eq(employee.id, id));
      if (!row) return reply.code(404).send({ error: "empleado no encontrado" });

      const engine = await vision();
      const results: Array<{ filename: string; ok: boolean; error?: string }> = [];
      for await (const part of req.parts()) {
        if (part.type !== "file") continue;
        const data = await part.toBuffer();
        try {
          const embedding = await engine.embed(new Uint8Array(data));
          const path = await savePhoto(join("enrollment", id), part.filename || "foto.jpg", data);
          await db.insert(faceSample).values({
            employeeId: id,
            embedding: Array.from(embedding),
            sourcePhoto: path,
          });
          results.push({ filename: part.filename ?? "", ok: true });
        } catch (err) {
          results.push({ filename: part.filename ?? "", ok: false, error: (err as Error).message });
        }
      }
      if (results.length === 0) {
        return reply.code(400).send({ error: "no se recibieron archivos (campo 'photos')" });
      }
      return reply.code(201).send({ results, status: await enrollStatus(id) });
    });

    // Finalizar enrolamiento: promedio de las muestras activas; bloquea <5.
    app.post("/employees/:id/face-samples/finalize", { preHandler: admin }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const [row] = await db.select().from(employee).where(eq(employee.id, id));
      if (!row) return reply.code(404).send({ error: "empleado no encontrado" });

      const status = await enrollStatus(id);
      if (!status.canFinalize) {
        return reply.code(400).send({
          error: `se requieren al menos ${ENROLL_LIMITS.min} fotos válidas (tiene ${status.validSamples})`,
          status,
        });
      }
      const samples = await db
        .select()
        .from(faceSample)
        .where(and(eq(faceSample.employeeId, id), eq(faceSample.active, true), eq(faceSample.kind, "single")));
      const avg = new Float32Array(512);
      for (const s of samples) {
        const vec = s.embedding as number[];
        for (let i = 0; i < 512; i++) avg[i] = avg[i]! + vec[i]!;
      }
      for (let i = 0; i < 512; i++) avg[i] = avg[i]! / samples.length;

      await db
        .update(faceSample)
        .set({ active: false })
        .where(and(eq(faceSample.employeeId, id), eq(faceSample.kind, "average")));
      await db.insert(faceSample).values({ employeeId: id, embedding: Array.from(l2Normalize(avg)), kind: "average" });
      return reply.code(200).send({ status: await enrollStatus(id), enrolled: true });
    });
  };
}

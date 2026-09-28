// Marcajes (REQ-REC, REQ-MAR): recognize (facial con evidencia), pin
// (fallback con evidencia) y sync (cola offline, también con evidencia).
// Regla de oro (constitution §4): foto + marcaje se escriben juntos —
// la foto va a disco ANTES de la transacción; si la transacción falla,
// la foto se elimina (compensación).

import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { and, eq, isNotNull } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import {
  DEFAULT_THRESHOLDS,
  MarkingKind,
  MarkingResult,
  PinMarkRequest,
  RecognizeResponse,
  SyncRequest,
  type RecognitionStatus,
} from "@recon/core";
import { employee, faceSample, marking, site } from "../db/schema";
import type { Database } from "../db/client";
import { requireDevice } from "../auth";
import { publish } from "../events";
import { dataDir, savePhoto } from "../storage";
import { vision } from "../vision";

type DeviceRequest = FastifyRequest & { device: { id: string; siteId: string; name: string } };

/** Lee un part de campo tolerando que busboy lo haya clasificado como file
 *  (si el cliente le puso Content-Type octet-stream). NUNCA dejar un file
 *  sin consumir: el parser se cuelga. El tipado de @fastify/multipart no
 *  expone toBuffer en la variante field, pero el runtime sí lo trae. */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function fieldValue(part: any): Promise<string> {
  if (part.type === "field") return String(part.value);
  return (await part.toBuffer()).toString();
}

function thresholds() {
  return {
    match: Number(process.env.MATCH_THRESHOLD ?? DEFAULT_THRESHOLDS.match),
    ambiguous: Number(process.env.AMBIGUOUS_THRESHOLD ?? DEFAULT_THRESHOLDS.ambiguous),
  };
}

async function gallery(db: Database) {
  const rows = await db
    .select({ employeeId: faceSample.employeeId, embedding: faceSample.embedding })
    .from(faceSample)
    .where(eq(faceSample.active, true));
  return rows.map((r) => ({ id: r.employeeId, vector: Float32Array.from(r.embedding as number[]) }));
}

async function namesFor(db: Database, employeeId: string, siteId: string) {
  const [emp] = await db.select().from(employee).where(eq(employee.id, employeeId));
  const [sit] = await db.select().from(site).where(eq(site.id, siteId));
  return { employeeName: emp?.fullName ?? "—", siteName: sit?.name ?? "—" };
}

/** marcaje + evidencia: foto primero, transacción después, compensación si falla. */
async function persistMarking(
  db: Database,
  values: Omit<typeof marking.$inferInsert, "id">,
  frame: Buffer,
  subdir: string,
) {
  const evidencePath = await savePhoto(subdir, `${values.method}-${Date.now()}.jpg`, frame);
  try {
    const [row] = await db.transaction(async (tx) =>
      tx.insert(marking).values({ ...values, evidencePath }).returning(),
    );
    return { row: row!, evidencePath };
  } catch (err) {
    await unlink(join(dataDir(), evidencePath)).catch(() => {});
    throw err;
  }
}

function feedItemFor(
  row: typeof marking.$inferSelect,
  names: { employeeName: string; siteName: string },
) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: names.employeeName,
    siteId: row.siteId,
    siteName: names.siteName,
    kind: row.kind,
    occurredAt: row.occurredAt.toISOString(),
    method: row.method,
    similarity: row.similarity,
    isOffline: row.isOffline,
    evidenceUrl: `/evidence/${row.id}/photo`,
  };
}

export function markRoutes(db: Database): FastifyPluginAsync {
  return async (app) => {
    const device = requireDevice(db);

    app.post("/marks/recognize", { preHandler: device }, async (req, reply) => {
      const dev = (req as DeviceRequest).device;
      const t0 = performance.now();

      let frame: Buffer | null = null;
      let kind: string | null = null;
      let liveness: Record<string, number> | null = null;
      let clientTime: string | undefined;
      for await (const part of req.parts()) {
        if (part.fieldname === "frame" && part.type === "file") frame = await part.toBuffer();
        else if (part.fieldname === "kind") kind = await fieldValue(part);
        else if (part.fieldname === "liveness") {
          try {
            liveness = JSON.parse(await fieldValue(part));
          } catch {
            liveness = null;
          }
        } else if (part.fieldname === "clientTime") {
          clientTime = await fieldValue(part);
        } else if (part.type === "file") {
          await part.toBuffer(); // drenar: no dejar streams sin consumir
        }
      }
      if (!frame) return reply.code(400).send({ error: "falta el campo 'frame' (JPEG)" });
      const kindParsed = MarkingKind.safeParse(kind ?? "in");
      if (!kindParsed.success) return reply.code(400).send({ error: "kind de marcaje inválido" });

      const engine = await vision();
      const gal = await gallery(db);
      const out = await engine.recognize(new Uint8Array(frame), gal);
      const th = thresholds();
      const latencyMs = Math.round(performance.now() - t0);

      if (!out.face || out.faceCount !== 1) {
        return reply.code(200).send(
          RecognizeResponse.parse({
            status: "capture_error",
            employeeId: null,
            employeeName: null,
            similarity: null,
            ambiguous: false,
            requirePin: false,
            livenessScores: liveness,
            latencyMs,
          }),
        );
      }

      const sim = out.best?.similarity ?? -1;
      let status: RecognitionStatus = "unknown";
      let requirePin = true;
      let ambiguous = false;
      let employeeId: string | null = null;

      if (out.best && sim >= th.match) {
        if (out.second && out.second.similarity >= th.ambiguous) {
          ambiguous = true; // dos personas demasiado parecidas → PIN, sin revelar identidad
        } else {
          status = "recognized";
          requirePin = false;
          employeeId = out.best.id;
        }
      } else if (sim >= th.ambiguous) {
        ambiguous = true; // zona gris [0.32, 0.38): no marcamos, exigimos PIN
      }

      if (status === "recognized" && employeeId) {
        const names = await namesFor(db, employeeId, dev.siteId);
        const { row } = await persistMarking(
          db,
          {
            employeeId,
            siteId: dev.siteId,
            deviceId: dev.id,
            kind: kindParsed.data,
            occurredAt: clientTime ? new Date(clientTime) : new Date(),
            method: "face",
            similarity: Math.round(sim * 10000) / 10000,
            liveness,
          },
          frame,
          join("evidence", dev.siteId),
        );
        publish(feedItemFor(row, names));
        return reply.code(200).send(
          RecognizeResponse.parse({
            status,
            employeeId,
            employeeName: names.employeeName,
            similarity: row.similarity,
            ambiguous,
            requirePin,
            livenessScores: liveness,
            latencyMs,
          }),
        );
      }

      return reply.code(200).send(
        RecognizeResponse.parse({
          status,
          employeeId: null,
          employeeName: null, // sin sugerir identidad (REQ-REC-02)
          similarity: out.best ? Math.round(sim * 10000) / 10000 : null,
          ambiguous,
          requirePin,
          livenessScores: liveness,
          latencyMs,
        }),
      );
    });

    app.post("/marks/pin", { preHandler: device }, async (req, reply) => {
      const dev = (req as DeviceRequest).device;
      let frame: Buffer | null = null;
      let payload: unknown = null;
      for await (const part of req.parts()) {
        if (part.fieldname === "frame" && part.type === "file") frame = await part.toBuffer();
        else if (part.fieldname === "payload") {
          try {
            payload = JSON.parse(await fieldValue(part));
          } catch {
            payload = null;
          }
        } else if (part.type === "file") {
          await part.toBuffer(); // drenar
        }
      }
      if (!frame) return reply.code(400).send({ error: "falta el campo 'frame' (foto de evidencia)" });
      const parsed = PinMarkRequest.safeParse(payload);
      if (!parsed.success) return reply.code(400).send({ error: "datos inválidos", issues: parsed.error.issues });

      const matched = await findByPin(db, parsed.data.pin);
      if (!matched) return reply.code(401).send({ error: "PIN inválido" });

      const occurredAt = parsed.data.clientTime ? new Date(parsed.data.clientTime) : new Date();
      const { row } = await persistMarking(
        db,
        {
          employeeId: matched.id,
          siteId: dev.siteId,
          deviceId: dev.id,
          kind: parsed.data.kind,
          occurredAt,
          method: "pin",
          similarity: null,
          liveness: parsed.data.livenessScores ?? null,
        },
        frame,
        join("evidence", dev.siteId),
      );
      publish(feedItemFor(row, { employeeName: matched.fullName, siteName: dev.name }));
      return reply.code(201).send(markingResult(row, matched.fullName));
    });

    app.post("/marks/sync", { preHandler: device }, async (req, reply) => {
      const dev = (req as DeviceRequest).device;
      let manifest: unknown = null;
      const photos = new Map<string, Buffer>();
      for await (const part of req.parts()) {
        if (part.type === "file" && part.filename) photos.set(part.filename, await part.toBuffer());
        else if (part.fieldname === "manifest") {
          try {
            manifest = JSON.parse(await fieldValue(part));
          } catch {
            manifest = null;
          }
        } else if (part.type === "file") {
          await part.toBuffer(); // drenar
        }
      }
      const parsed = SyncRequest.safeParse(manifest);
      if (!parsed.success) return reply.code(400).send({ error: "manifest inválido", issues: parsed.error.issues });

      let accepted = 0;
      const rejected: Array<{ index: number; reason: string }> = [];
      for (const [i, item] of parsed.data.items.entries()) {
        const matched = await findByPin(db, item.pin);
        if (!matched) {
          rejected.push({ index: i, reason: "PIN inválido" });
          continue;
        }
        const photoName = item.photo ?? `item-${i}.jpg`;
        const photo = photos.get(photoName);
        if (!photo) {
          rejected.push({ index: i, reason: `falta la foto de evidencia (${photoName})` });
          continue;
        }
        await persistMarking(
          db,
          {
            employeeId: matched.id,
            siteId: dev.siteId,
            deviceId: dev.id,
            kind: item.kind,
            occurredAt: new Date(item.clientTime), // hora del dispositivo (REQ-MAR-03)
            method: "pin",
            similarity: null,
            liveness: item.livenessScores ?? null,
            isOffline: true,
          },
          photo,
          join("evidence", dev.siteId),
        );
        accepted++;
      }
      return reply.code(200).send({ accepted, rejected });
    });
  };
}

async function findByPin(db: Database, pin: string) {
  const candidates = await db
    .select()
    .from(employee)
    .where(and(eq(employee.active, true), isNotNull(employee.pinHash)));
  for (const emp of candidates) {
    if (await verify(emp.pinHash!, pin)) return emp;
  }
  return null;
}

function markingResult(row: typeof marking.$inferSelect, fullName: string) {
  return MarkingResult.parse({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: fullName,
    kind: row.kind,
    occurredAt: row.occurredAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    method: row.method,
    similarity: row.similarity,
    isOffline: row.isOffline,
    evidenceUrl: `/evidence/${row.id}/photo`,
  });
}

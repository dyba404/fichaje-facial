import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { login, makeTestApp, multipart } from "./helpers";
import { employee, faceSample, marking, site } from "../src/db/schema";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (persona: number, file: string) => join(here, "fixtures", `persona-${persona}`, file);

const PHOTOS = [
  "01-original.jpg",
  "02-rotada-derecha.jpg",
  "03-rotada-oscura.jpg",
  "04-contraluz-claro.jpg",
  "05-encuadre-cerca.jpg",
];

async function uploadPhotos(
  ctx: Awaited<ReturnType<typeof makeTestApp>>,
  cookies: Record<string, string>,
  employeeId: string,
  files: Array<{ persona: number; file: string }>,
) {
  const parts = [];
  for (const f of files) {
    parts.push({
      name: "photos",
      filename: `${f.persona}-${f.file}`,
      type: "image/jpeg",
      data: await readFile(fixture(f.persona, f.file)),
    });
  }
  const body = multipart(parts);
  return ctx.app.inject({
    method: "POST",
    url: `/employees/${employeeId}/face-samples`,
    cookies,
    headers: body.headers,
    payload: body.payload,
  });
}

describe("empleados y enrolamiento (REQ-ENR, REQ-SEDE-02)", () => {
  let ctx: Awaited<ReturnType<typeof makeTestApp>>;
  let adminCookies: Record<string, string>;
  let supervisorCookies: Record<string, string>;
  let siteA: string;
  let siteB: string;

  beforeAll(async () => {
    ctx = await makeTestApp();
    adminCookies = await login(ctx.app, "admin@test.local", ctx.ADMIN_PASSWORD);
    supervisorCookies = await login(ctx.app, "supervisor@test.local", ctx.ADMIN_PASSWORD);
    const [a] = await ctx.db.insert(site).values({ name: "Sede A" }).returning();
    const [b] = await ctx.db.insert(site).values({ name: "Sede B" }).returning();
    siteA = a!.id;
    siteB = b!.id;
  }, 240_000);

  afterAll(async () => {
    await ctx?.app?.close();
    await ctx?.pool?.end();
  });

  it("POST /employees sin sesión → 401; supervisor → 403", async () => {
    const noAuth = await ctx.app.inject({
      method: "POST",
      url: "/employees",
      payload: { fullName: "X Y", docNumber: "12345678", siteId: siteA, consent: true },
    });
    expect(noAuth.statusCode).toBe(401);

    const forbidden = await ctx.app.inject({
      method: "POST",
      url: "/employees",
      cookies: supervisorCookies,
      payload: { fullName: "X Y", docNumber: "12345678", siteId: siteA, consent: true },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("admin crea empleado; exige consentimiento; DNI duplicado → 409", async () => {
    const sinConsent = await ctx.app.inject({
      method: "POST",
      url: "/employees",
      cookies: adminCookies,
      payload: { fullName: "María Quispe", docNumber: "87654321", siteId: siteA },
    });
    expect(sinConsent.statusCode).toBe(400);

    const ok = await ctx.app.inject({
      method: "POST",
      url: "/employees",
      cookies: adminCookies,
      payload: { fullName: "María Quispe", docNumber: "87654321", siteId: siteA, pin: "2468", consent: true },
    });
    expect(ok.statusCode).toBe(201);
    const emp = ok.json();
    expect(emp.faceEnrolled).toBe(false);
    expect(emp.pinHash).toBeUndefined(); // el hash nunca sale de la API

    const dupe = await ctx.app.inject({
      method: "POST",
      url: "/employees",
      cookies: adminCookies,
      payload: { fullName: "Otra María", docNumber: "87654321", siteId: siteA, consent: true },
    });
    expect(dupe.statusCode).toBe(409);
  });

  it("finalizar con <5 muestras válidas → 400 (REQ-ENR-02)", async () => {
    const [emp] = await ctx.db
      .insert(employee)
      .values({ fullName: "Juan Flores", docNumber: "11223344", siteId: siteA, consentAt: new Date() })
      .returning();
    const res = await ctx.app.inject({
      method: "POST",
      url: `/employees/${emp!.id}/face-samples/finalize`,
      cookies: adminCookies,
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("al menos 5");
  });

  it("foto sin cara → rechazada por el motor de visión; válidas no cambian", async () => {
    const [emp] = await ctx.db
      .insert(employee)
      .values({ fullName: "Sin Cara", docNumber: "55667788", siteId: siteA, consentAt: new Date() })
      .returning();

    const blank = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#224488" } })
      .jpeg()
      .toBuffer();
    const res = await uploadPhotos(ctx, adminCookies, emp!.id, [{ persona: 1, file: "01-original.jpg" }]);

    const blankRes = await ctx.app.inject({
      method: "POST",
      url: `/employees/${emp!.id}/face-samples`,
      cookies: adminCookies,
      ...multipart([{ name: "photos", filename: "blank.jpg", type: "image/jpeg", data: blank }]),
    });
    expect(blankRes.statusCode).toBe(201);
    const results = blankRes.json().results;
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toContain("capture_error: 0 caras");
    expect(blankRes.json().status.validSamples).toBe(1); // solo la válida contó
  }, 120_000);

  it("enrolamiento completo: 5 fotos → finalize → faceEnrolled=true", async () => {
    const [emp] = await ctx.db
      .insert(employee)
      .values({ fullName: "Rosa Ccahuana", docNumber: "99887766", siteId: siteA, consentAt: new Date() })
      .returning();

    const res = await uploadPhotos(
      ctx,
      adminCookies,
      emp!.id,
      PHOTOS.map((file) => ({ persona: 1, file })),
    );
    expect(res.statusCode).toBe(201);
    const status = res.json().status;
    expect(status.validSamples).toBe(5);
    expect(status.canFinalize).toBe(true);

    const detail = await ctx.app.inject({ method: "GET", url: `/employees/${emp!.id}`, cookies: adminCookies });
    expect(detail.json().faceEnrolled).toBe(false); // aún sin finalize

    const fin = await ctx.app.inject({
      method: "POST",
      url: `/employees/${emp!.id}/face-samples/finalize`,
      cookies: adminCookies,
    });
    expect(fin.statusCode).toBe(200);
    expect(fin.json().enrolled).toBe(true);

    const after = await ctx.app.inject({ method: "GET", url: `/employees/${emp!.id}`, cookies: adminCookies });
    expect(after.json().faceEnrolled).toBe(true);
  }, 240_000);

  it("reasignar sede NO altera el historial de marcajes (REQ-SEDE-02)", async () => {
    const [emp] = await ctx.db
      .insert(employee)
      .values({ fullName: "Luis Ramos", docNumber: "66554433", siteId: siteA, consentAt: new Date() })
      .returning();
    await ctx.db.insert(marking).values({
      employeeId: emp!.id,
      siteId: siteA,
      kind: "in",
      occurredAt: new Date(),
      method: "pin",
    });

    const patched = await ctx.app.inject({
      method: "PATCH",
      url: `/employees/${emp!.id}`,
      cookies: adminCookies,
      payload: { siteId: siteB },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().siteId).toBe(siteB);

    const marks = await ctx.db.select().from(marking).where(eq(marking.employeeId, emp!.id));
    expect(marks).toHaveLength(1);
    expect(marks[0]!.siteId).toBe(siteA); // el historial queda en la sede original
  });

  it("re-enrolamiento: reset + nueva carga reemplaza vectores sin tocar marcajes (REQ-ENR-03)", async () => {
    const [emp] = await ctx.db
      .insert(employee)
      .values({ fullName: "Ana Paredes", docNumber: "44332211", siteId: siteA, consentAt: new Date() })
      .returning();
    await ctx.db.insert(marking).values({
      employeeId: emp!.id,
      siteId: siteA,
      kind: "in",
      occurredAt: new Date(),
      method: "face",
      similarity: 0.62,
    });

    // primer enrolamiento con persona-1
    await uploadPhotos(ctx, adminCookies, emp!.id, PHOTOS.map((file) => ({ persona: 1, file })));
    await ctx.app.inject({
      method: "POST",
      url: `/employees/${emp!.id}/face-samples/finalize`,
      cookies: adminCookies,
    });

    // re-enrolar con persona-2
    await ctx.app.inject({
      method: "POST",
      url: `/employees/${emp!.id}/face-samples/reset`,
      cookies: adminCookies,
    });
    await uploadPhotos(ctx, adminCookies, emp!.id, PHOTOS.map((file) => ({ persona: 2, file })));
    const fin = await ctx.app.inject({
      method: "POST",
      url: `/employees/${emp!.id}/face-samples/finalize`,
      cookies: adminCookies,
    });
    expect(fin.statusCode).toBe(200);

    const activeSamples = await ctx.db
      .select()
      .from(faceSample)
      .where(eq(faceSample.employeeId, emp!.id));
    const activeOnes = activeSamples.filter((s) => s.active);
    expect(activeOnes).toHaveLength(6); // 5 singles nuevos + 1 average
    expect(activeOnes.filter((s) => s.kind === "average")).toHaveLength(1);

    const marks = await ctx.db.select().from(marking).where(eq(marking.employeeId, emp!.id));
    expect(marks).toHaveLength(1); // el historial NUNCA se toca
  }, 300_000);
});

import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { enrollEmployee, fixturePath, login, makeTestApp, multipart } from "./helpers";
import { marking } from "../src/db/schema";
import { subscribe } from "../src/events";
import { dataDir } from "../src/storage";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function frameOf(persona: number, file: string): Promise<Buffer> {
  return readFile(fixturePath(persona, file));
}

async function recognize(ctx: Awaited<ReturnType<typeof makeTestApp>>, apiKey: string, frame: Buffer, kind = "in") {
  const body = multipart([
    { name: "frame", filename: "frame.jpg", type: "image/jpeg", data: frame },
    { name: "kind", data: Buffer.from(kind) },
    { name: "liveness", data: Buffer.from(JSON.stringify({ eyeBlink: 0.9, yaw: 14 })) },
  ]);
  return ctx.app.inject({
    method: "POST",
    url: "/marks/recognize",
    headers: { authorization: `Device ${apiKey}`, ...body.headers },
    payload: body.payload,
  });
}

describe("marcajes (REQ-REC, REQ-MAR, REQ-DASH-02)", () => {
  let ctx: Awaited<ReturnType<typeof makeTestApp>>;
  let adminCookies: Record<string, string>;
  let apiKey: string;
  let siteA: string;
  let maria: string; // enrolada con persona-1, pin 2468
  let juan: string; // enrolado con persona-2, pin 1357

  beforeAll(async () => {
    ctx = await makeTestApp();
    adminCookies = await login(ctx.app, "admin@test.local", ctx.ADMIN_PASSWORD);
    const { site } = await import("../src/db/schema");
    const [a] = await ctx.db.insert(site).values({ name: "Sede A" }).returning();
    siteA = a!.id;
    const deviceRes = await ctx.app.inject({
      method: "POST",
      url: "/devices",
      cookies: adminCookies,
      payload: { name: "Kiosco entrada", siteId: siteA },
    });
    apiKey = deviceRes.json().apiKey;

    maria = await enrollEmployee(
      ctx,
      adminCookies,
      { fullName: "María Quispe", docNumber: "87654321", siteId: siteA, pin: "2468" },
      1,
    );
    juan = await enrollEmployee(
      ctx,
      adminCookies,
      { fullName: "Juan Flores", docNumber: "11223344", siteId: siteA, pin: "1357" },
      2,
    );
  }, 300_000);

  afterAll(async () => {
    await ctx?.app?.close();
    await ctx?.pool?.end();
  });

  it("recognize sin device API key → 401", async () => {
    const frame = await frameOf(1, "01-original.jpg");
    const body = multipart([{ name: "frame", filename: "f.jpg", type: "image/jpeg", data: frame }]);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/marks/recognize",
      headers: body.headers,
      payload: body.payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it("recognize facial OK: reconoce, marca con evidencia y publica SSE (REQ-REC-01, REQ-MAR-01)", async () => {
    let sseItem: unknown = null;
    const unsub = subscribe((item) => {
      sseItem = item;
    });
    try {      const before = await ctx.db.select().from(marking);
      const res = await recognize(ctx, apiKey, await frameOf(1, "01-original.jpg"), "in");
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("recognized");
      expect(body.employeeName).toBe("María Quispe");
      expect(body.similarity).toBeGreaterThanOrEqual(0.5);
      expect(body.requirePin).toBe(false);
      console.log(`[marcaje] recognize end-to-end (HTTP+CV+BD): ${body.latencyMs} ms, sim=${body.similarity}`);
      expect(body.latencyMs).toBeLessThan(1500);

      const after = await ctx.db.select().from(marking);
      expect(after).toHaveLength(before.length + 1);
      const m = after.at(-1)!;
      expect(m.method).toBe("face");
      expect(m.kind).toBe("in");
      expect(m.evidencePath).toBeTruthy();

      // la evidencia existe en disco y se sirve autenticada
      await stat(join(dataDir(), m.evidencePath!));
      const photo = await ctx.app.inject({
        method: "GET",
        url: `/evidence/${m.id}/photo`,
        cookies: adminCookies,
      });
      expect(photo.statusCode).toBe(200);
      expect(photo.headers["content-type"]).toBe("image/jpeg");

      // SSE publicó el evento con la forma del FeedItem
      expect(sseItem).not.toBeNull();
      expect((sseItem as { employeeName: string }).employeeName).toBe("María Quispe");
      expect((sseItem as { evidenceUrl: string }).evidenceUrl).toBe(`/evidence/${m.id}/photo`);
    } finally {
      unsub();
    }
  }, 120_000);

  it("persona desconocida → unknown + requirePin, sin sugerir identidad y sin marcaje (REQ-REC-02)", async () => {
    const before = await ctx.db.select().from(marking);
    const res = await recognize(ctx, apiKey, await frameOf(4, "01-original.jpg"));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("unknown");
    expect(body.requirePin).toBe(true);
    expect(body.employeeName).toBeNull();
    expect(body.similarity).toBeLessThan(0.38);

    const after = await ctx.db.select().from(marking);
    expect(after).toHaveLength(before.length);
  }, 120_000);

  it("frame con 2 caras → capture_error (REQ-REC-03)", async () => {
    // apilado vertical: al reescalar a 640×640 las caras siguen detectables
    // (sondeo previo: 2 caras, scores 0.83/0.80)
    const face1 = await sharp(await frameOf(1, "01-original.jpg")).resize({ height: 400 }).toBuffer();
    const face2 = await sharp(await frameOf(2, "01-original.jpg")).resize({ height: 400 }).toBuffer();
    const m1 = await sharp(face1).metadata();
    const comp = await sharp({
      create: { width: m1.width! + 40, height: 860, channels: 3, background: "#ffffff" },
    })
      .composite([
        { input: face1, left: 20, top: 20 },
        { input: face2, left: 20, top: 440 },
      ])
      .jpeg()
      .toBuffer();

    const res = await recognize(ctx, apiKey, comp);
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("capture_error");
  }, 120_000);

  it("PIN válido marca con evidencia; PIN inválido → 401 (REQ-MAR-01, fallback REQ-REC-02)", async () => {
    // OJO: un body por request — dos llamadas a multipart() dan boundaries distintos
    const badBody = multipart([
      { name: "frame", filename: "evidencia.jpg", type: "image/jpeg", data: Buffer.from("jpeg-simulado") },
      { name: "payload", data: Buffer.from(JSON.stringify({ pin: "0000", kind: "out" })) },
    ]);
    const bad = await ctx.app.inject({
      method: "POST",
      url: "/marks/pin",
      headers: { authorization: `Device ${apiKey}`, ...badBody.headers },
      payload: badBody.payload,
    });
    expect(bad.statusCode).toBe(401);

    const okBody = multipart([
      { name: "frame", filename: "evidencia.jpg", type: "image/jpeg", data: Buffer.from("jpeg-simulado") },
      {
        name: "payload",
        data: Buffer.from(JSON.stringify({ pin: "2468", kind: "out", clientTime: new Date().toISOString() })),
      },
    ]);
    const ok = await ctx.app.inject({
      method: "POST",
      url: "/marks/pin",
      headers: { authorization: `Device ${apiKey}`, ...okBody.headers },
      payload: okBody.payload,
    });
    expect(ok.statusCode).toBe(201);
    const result = ok.json();
    expect(result).toMatchObject({ method: "pin", kind: "out", employeeName: "María Quispe" });
    const marks = await ctx.db.select().from(marking).where(eq(marking.employeeId, maria));
    const pinMark = marks.find((m) => m.method === "pin");
    expect(pinMark?.evidencePath).toBeTruthy();
  });

  it("sync offline: 2 aceptados con evidencia + 1 rechazado por PIN (REQ-MAR-03)", async () => {
    const t1 = new Date(Date.now() - 3600_000); // hace 1 hora, en el kiosco sin red
    const t2 = new Date(Date.now() - 1800_000);
    const manifest = {
      items: [
        { pin: "2468", kind: "in", clientTime: t1.toISOString(), photo: "item-0.jpg" },
        { pin: "1357", kind: "out", clientTime: t2.toISOString(), photo: "item-1.jpg" },
        { pin: "9999", kind: "in", clientTime: t2.toISOString(), photo: "item-2.jpg" },
      ],
    };
    const body = multipart([
      { name: "manifest", data: Buffer.from(JSON.stringify(manifest)) },
      { name: "photos", filename: "item-0.jpg", type: "image/jpeg", data: await frameOf(1, "02-rotada-derecha.jpg") },
      { name: "photos", filename: "item-1.jpg", type: "image/jpeg", data: await frameOf(2, "02-rotada-derecha.jpg") },
    ]);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/marks/sync",
      headers: { authorization: `Device ${apiKey}`, ...body.headers },
      payload: body.payload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accepted: 2, rejected: [{ index: 2, reason: "PIN inválido" }] });

    const offline = await ctx.db.select().from(marking).where(eq(marking.isOffline, true));
    expect(offline).toHaveLength(2);
    for (const m of offline) {
      expect(m.receivedAt.getTime()).toBeGreaterThan(m.occurredAt.getTime());
      expect(m.evidencePath).toBeTruthy(); // offline TAMBIÉN tiene evidencia (constitution §4)
      await stat(join(dataDir(), m.evidencePath!));
    }
    const mariaOffline = offline.find((m) => m.employeeId === maria)!;
    expect(mariaOffline.occurredAt.toISOString()).toBe(t1.toISOString()); // hora del dispositivo
  }, 120_000);

  it("si falla la escritura de la evidencia, NO se crea el marcaje (REQ-MAR-01 transaccional)", async () => {
    const before = await ctx.db.select().from(marking);
    const fakeFile = join(dataDir(), "no-es-un-directorio.tmp");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(fakeFile, "x");
    const original = process.env.DATA_DIR;
    process.env.DATA_DIR = fakeFile; // mkdir sobre un archivo → falla
    try {
      // María está enrolada: el recognize llega a guardar evidencia y explota
      const res = await recognize(ctx, apiKey, await frameOf(1, "01-original.jpg"));
      expect(res.statusCode).toBe(500);
      const after = await ctx.db.select().from(marking);
      expect(after).toHaveLength(before.length); // sin fila huérfana
    } finally {
      if (original === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = original;
    }
  }, 120_000);
});

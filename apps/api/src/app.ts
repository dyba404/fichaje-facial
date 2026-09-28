import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Database } from "./db/client";
import { registerSession } from "./auth";
import { authRoutes } from "./routes/auth";
import { siteRoutes } from "./routes/sites";
import { employeeRoutes } from "./routes/employees";
import { deviceRoutes } from "./routes/devices";
import { markRoutes } from "./routes/marks";
import { eventRoutes } from "./routes/events";
import { evidenceRoutes } from "./routes/evidence";
import { closeVision } from "./vision";

export async function buildApp(opts: { db?: Database } = {}) {
  const db = opts.db ?? createDb().db;

  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "warn" },
  });

  registerSession(app);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 20 } });

  app.get("/healthz", async () => ({
    ok: true,
    app: "recon-api",
    time: new Date().toISOString(),
  }));

  app.get("/", async () => ({
    name: "recon",
    description: "API de fichaje con reconocimiento facial",
    version: "0.1.0",
  }));

  // Kiosco de demostración (borrador de Fase 4): página única servida por la API.
  app.get("/demo", async (_req, reply) => {
    const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo.html"));
    return reply.type("text/html; charset=utf-8").send(html);
  });

  await app.register(authRoutes(db));
  await app.register(siteRoutes(db));
  await app.register(employeeRoutes(db));
  await app.register(deviceRoutes(db));
  await app.register(markRoutes(db));
  await app.register(eventRoutes(db));
  await app.register(evidenceRoutes(db));

  app.addHook("onClose", async () => {
    await closeVision();
  });

  return { app, db };
}

import Fastify from "fastify";
import { createDb, type Database } from "./db/client";
import { registerSession } from "./auth";
import { authRoutes } from "./routes/auth";
import { siteRoutes } from "./routes/sites";

export async function buildApp(opts: { db?: Database } = {}) {
  const db = opts.db ?? createDb().db;

  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "warn" },
  });

  registerSession(app);

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

  await app.register(authRoutes(db));
  await app.register(siteRoutes(db));

  return { app, db };
}

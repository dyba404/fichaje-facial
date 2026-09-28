// Kioscos registrados (ADR-0006): la apiKey se muestra UNA vez al crear.

import { randomBytes, createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { DeviceRegister } from "@recon/core";
import { device } from "../db/schema";
import type { Database } from "../db/client";
import { requireAdmin, requireAuth } from "../auth";

export function deviceRoutes(db: Database): FastifyPluginAsync {
  return async (app) => {
    const admin = [requireAuth(db), requireAdmin];

    app.get("/devices", { preHandler: admin }, async () => {
      return db.select().from(device).orderBy(device.name);
    });

    app.post("/devices", { preHandler: admin }, async (req, reply) => {
      const parsed = DeviceRegister.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "datos inválidos", issues: parsed.error.issues });
      }
      const apiKey = randomBytes(24).toString("base64url");
      const [d] = await db
        .insert(device)
        .values({
          name: parsed.data.name,
          siteId: parsed.data.siteId,
          apiKeyHash: createHash("sha256").update(apiKey).digest("hex"),
        })
        .returning();
      return reply.code(201).send({ device: d, apiKey });
    });

    app.delete("/devices/:id", { preHandler: admin }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const [d] = await db.delete(device).where(eq(device.id, id)).returning();
      if (!d) return reply.code(404).send({ error: "dispositivo no encontrado" });
      return { ok: true }; // revocación inmediata de la API key
    });
  };
}

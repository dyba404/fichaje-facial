import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { SiteCreate, SitePatch } from "@recon/core";
import { site } from "../db/schema";
import type { Database } from "../db/client";
import { requireAdmin, requireAuth } from "../auth";

// Sedes (REQ-SEDE): admin administra, cualquier usuario autenticado consulta.
// Desactivar una sede no borra nada: los marcajes históricos quedan intactos.
export function siteRoutes(db: Database): FastifyPluginAsync {
  return async (app) => {
    app.get("/sites", { preHandler: requireAuth(db) }, async () => {
      return db.select().from(site).orderBy(site.name);
    });

    app.get("/sites/:id", { preHandler: requireAuth(db) }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const [s] = await db.select().from(site).where(eq(site.id, id));
      if (!s) return reply.code(404).send({ error: "sede no encontrada" });
      return s;
    });

    app.post("/sites", { preHandler: [requireAuth(db), requireAdmin] }, async (req, reply) => {
      const parsed = SiteCreate.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "datos inválidos", issues: parsed.error.issues });
      }
      const [s] = await db
        .insert(site)
        .values({ name: parsed.data.name, address: parsed.data.address ?? null })
        .returning();
      return reply.code(201).send(s);
    });

    app.patch("/sites/:id", { preHandler: [requireAuth(db), requireAdmin] }, async (req, reply) => {
      const parsed = SitePatch.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "datos inválidos", issues: parsed.error.issues });
      }
      const { id } = req.params as { id: string };
      const [s] = await db.update(site).set(parsed.data).where(eq(site.id, id)).returning();
      if (!s) return reply.code(404).send({ error: "sede no encontrada" });
      return s;
    });
  };
}

// Evidencia fotográfica (REQ-MAR): solo por endpoint autenticado, jamás
// estática. admin ve todo; supervisor solo su sede (MVP: admin).

import { createReadStream } from "node:fs";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { marking } from "../db/schema";
import type { Database } from "../db/client";
import { requireAuth } from "../auth";
import { dataDir } from "../storage";

export function evidenceRoutes(db: Database): FastifyPluginAsync {
  return async (app) => {
    app.get("/evidence/:markingId/photo", { preHandler: requireAuth(db) }, async (req, reply) => {
      const { markingId } = req.params as { markingId: string };
      const [m] = await db.select().from(marking).where(eq(marking.id, markingId));
      if (!m?.evidencePath) return reply.code(404).send({ error: "evidencia no encontrada" });

      const path = join(dataDir(), m.evidencePath);
      try {
        await stat(path);
      } catch {
        return reply.code(404).send({ error: "archivo de evidencia faltante" });
      }
      return reply.type("image/jpeg").send(createReadStream(path));
    });
  };
}

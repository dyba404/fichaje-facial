// Feed en vivo por SSE (REQ-DASH-02): unidireccional, reconexión nativa.

import type { FastifyPluginAsync } from "fastify";
import type { Database } from "../db/client";
import { requireAuth } from "../auth";
import { subscribe } from "../events";

export function eventRoutes(_db: Database): FastifyPluginAsync {
  return async (app) => {
    app.get("/events", { preHandler: requireAuth(_db) }, async (req, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      reply.raw.write(": conectado\n\n");
      const unsub = subscribe((item) => {
        reply.raw.write(`data: ${JSON.stringify(item)}\n\n`);
      });
      req.raw.on("close", () => {
        unsub();
        reply.raw.end();
      });
    });
  };
}

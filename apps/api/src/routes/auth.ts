import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import { LoginRequest, SessionUser } from "@recon/core";
import { appUser } from "../db/schema";
import type { Database } from "../db/client";
import { requireAuth } from "../auth";

export function authRoutes(db: Database): FastifyPluginAsync {
  return async (app) => {
    app.post("/auth/login", async (req, reply) => {
      const parsed = LoginRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "datos inválidos" });
      }
      const [u] = await db.select().from(appUser).where(eq(appUser.email, parsed.data.email));
      if (!u || !u.active) {
        return reply.code(401).send({ error: "credenciales inválidas" });
      }
      const ok = await verify(u.passwordHash, parsed.data.password);
      if (!ok) {
        return reply.code(401).send({ error: "credenciales inválidas" });
      }
      req.session.set("userId", u.id);
      return { user: SessionUser.parse({ id: u.id, email: u.email, role: u.role, siteId: u.siteId }) };
    });

    app.post("/auth/logout", async (req) => {
      req.session.delete();
      return { ok: true };
    });

    app.get("/auth/me", { preHandler: requireAuth(db) }, async (req) => {
      return (req as RequestWithUser).user;
    });
  };
}

type RequestWithUser = FastifyRequest & { user: ReturnType<typeof SessionUser.parse> };

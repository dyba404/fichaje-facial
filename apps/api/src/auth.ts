// Auth (ADR-0006): sesión por cookie httpOnly + argon2id para usuarios del
// dashboard; kioscos se autentican con device API key (header Authorization).

import { createHash } from "node:crypto";
import secureSession from "@fastify/secure-session";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { appUser, device } from "./db/schema";
import type { Database } from "./db/client";

declare module "@fastify/secure-session" {
  interface SessionData {
    userId: string;
  }
}

export interface AuthedUser {
  id: string;
  email: string;
  role: "admin" | "supervisor";
  siteId: string | null;
}

export function registerSession(app: FastifyInstance): void {
  const secret = createHash("sha256")
    .update(process.env.SESSION_SECRET ?? "dev-secret-recon")
    .digest();
  app.register(secureSession, {
    key: secret,
    cookie: { path: "/", httpOnly: true, sameSite: "lax", secure: false },
  });
}

export function requireAuth(db: Database) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = req.session.get("userId") as string | undefined;
    if (!userId) {
      await reply.code(401).send({ error: "sesión requerida" });
      return;
    }
    const [u] = await db.select().from(appUser).where(eq(appUser.id, userId));
    if (!u || !u.active) {
      await reply.code(401).send({ error: "sesión inválida" });
      return;
    }
    (req as FastifyRequest & { user: AuthedUser }).user = {
      id: u.id,
      email: u.email,
      role: u.role,
      siteId: u.siteId,
    };
  };
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = (req as FastifyRequest & { user?: AuthedUser }).user;
  if (user?.role !== "admin") {
    await reply.code(403).send({ error: "requiere rol admin" });
  }
}

/** Kiosco: valida `Authorization: Device <apiKey>` y actualiza last_seen_at. */
export function requireDevice(db: Database) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const m = /^Device\s+(.+)$/i.exec(req.headers.authorization ?? "");
    if (!m) {
      await reply.code(401).send({ error: "device API key requerida" });
      return;
    }
    const hash = createHash("sha256").update(m[1]!).digest("hex");
    const [d] = await db.select().from(device).where(eq(device.apiKeyHash, hash));
    if (!d) {
      await reply.code(401).send({ error: "device API key inválida" });
      return;
    }
    await db.update(device).set({ lastSeenAt: new Date() }).where(eq(device.id, d.id));
    (req as FastifyRequest & { device: typeof d }).device = d;
  };
}

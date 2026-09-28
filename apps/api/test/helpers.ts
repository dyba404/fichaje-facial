// Helpers de test de la API: BD efímera recon_test (migraciones reales),
// truncado por test, seed de usuarios y login por cookie.

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "@node-rs/argon2";
import * as schema from "../src/db/schema";
import { buildApp } from "../src/app";
import { appUser } from "../src/db/schema";

export const TEST_URL = "postgres://recon:recon@localhost:5434/recon_test";

const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test-password-123";
const SUPERVISOR_EMAIL = "supervisor@test.local";

export async function makeTestApp() {
  const pool = new Pool({ connectionString: TEST_URL, max: 5 });
  const db = drizzle(pool, { schema });
  await migrate(db, {
    migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle"),
  });
  await db.execute(
    sql`TRUNCATE site, app_user, employee, face_sample, device, marking, marking_correction, company_settings CASCADE`,
  );

  const [admin] = await db
    .insert(appUser)
    .values({
      email: ADMIN_EMAIL,
      passwordHash: await hash(ADMIN_PASSWORD),
      role: "admin",
    })
    .returning();
  const [supervisor] = await db
    .insert(appUser)
    .values({
      email: SUPERVISOR_EMAIL,
      passwordHash: await hash(ADMIN_PASSWORD),
      role: "supervisor",
    })
    .returning();

  const { app } = await buildApp({ db });
  return { app, db, pool, admin: admin!, supervisor: supervisor!, ADMIN_PASSWORD };
}

/** Login y devuelve cookies de sesión en formato Record para inject(). */
export async function login(
  app: Awaited<ReturnType<typeof makeTestApp>>["app"],
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`login falló (${res.statusCode}): ${res.body}`);
  return Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));
}

/** Cuerpo multipart manual (sin depender de FormData de inject).
 *  Los parts SIN filename no llevan Content-Type: así busboy los clasifica
 *  como fields y no como files (hallazgo del debug de Fase 3). */
export function multipart(
  parts: Array<{ name: string; filename?: string; type?: string; data: Buffer }>,
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = "----recon-test-" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const p of parts) {
    const contentType = p.filename ? (p.type ?? "application/octet-stream") : null;
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"` +
          (p.filename ? `; filename="${p.filename}"` : "") +
          (contentType ? `\r\nContent-Type: ${contentType}` : "") +
          `\r\n\r\n`,
      ),
    );
    chunks.push(p.data);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

export const here = dirname(fileURLToPath(import.meta.url));
export const ENROLL_PHOTOS = [
  "01-original.jpg",
  "02-rotada-derecha.jpg",
  "03-rotada-oscura.jpg",
  "04-contraluz-claro.jpg",
  "05-encuadre-cerca.jpg",
];
export const fixturePath = (persona: number, file: string) => join(here, "fixtures", `persona-${persona}`, file);

/** Crea empleado, sube 5 fotos de `persona` y finaliza el enrolamiento. */
export async function enrollEmployee(
  ctx: Awaited<ReturnType<typeof makeTestApp>>,
  cookies: Record<string, string>,
  data: { fullName: string; docNumber: string; siteId: string; pin?: string },
  persona: number,
): Promise<string> {
  const created = await ctx.app.inject({
    method: "POST",
    url: "/employees",
    cookies,
    payload: { ...data, consent: true },
  });
  if (created.statusCode !== 201) throw new Error(`crear empleado falló: ${created.body}`);
  const id = created.json().id as string;

  const parts = [];
  for (const file of ENROLL_PHOTOS) {
    parts.push({
      name: "photos",
      filename: `${persona}-${file}`,
      type: "image/jpeg",
      data: await readFile(fixturePath(persona, file)),
    });
  }
  const body = multipart(parts);
  const uploaded = await ctx.app.inject({
    method: "POST",
    url: `/employees/${id}/face-samples`,
    cookies,
    headers: body.headers,
    payload: body.payload,
  });
  if (uploaded.statusCode !== 201) throw new Error(`subida falló: ${uploaded.body}`);

  const fin = await ctx.app.inject({
    method: "POST",
    url: `/employees/${id}/face-samples/finalize`,
    cookies,
  });
  if (fin.statusCode !== 200) throw new Error(`finalize falló: ${fin.body}`);
  return id;
}

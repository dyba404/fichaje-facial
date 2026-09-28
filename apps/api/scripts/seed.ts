// Seed idempotente del MVP: empresa demo, sede principal y admin inicial.
// Uso: npm run seed -w @recon/api   (respeta ADMIN_EMAIL / ADMIN_PASSWORD)

import "../src/env";
import { hash } from "@node-rs/argon2";
import { count, eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { appUser, companySettings, site } from "../src/db/schema";

const email = process.env.ADMIN_EMAIL ?? "admin@recon.local";
const password = process.env.ADMIN_PASSWORD ?? "recon-admin-2026";

const { db, pool } = createDb();

const [settings] = await db.select({ n: count() }).from(companySettings);
if (settings?.n === 0) {
  await db.insert(companySettings).values({ ruc: "20100047218", legalName: "recon demo SAC" });
  console.log("company_settings: empresa demo creada (RUC placeholder — configurar el real en producción)");
}

const [sites] = await db.select({ n: count() }).from(site);
if (sites?.n === 0) {
  await db.insert(site).values({ name: "Sede principal" });
  console.log("site: 'Sede principal' creada");
}

const [existing] = await db.select().from(appUser).where(eq(appUser.email, email));
if (!existing) {
  const [sede] = await db.select().from(site).limit(1);
  await db.insert(appUser).values({
    email,
    passwordHash: await hash(password),
    role: "admin",
    siteId: null,
  });
  console.log(`app_user: admin creado → ${email} / ${password} (cambiar en producción)`);
} else {
  console.log(`app_user: ${email} ya existe — nada que hacer`);
}

await pool.end();

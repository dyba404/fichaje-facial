import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>["db"];

export function createDb(url = process.env.DATABASE_URL ?? "postgres://recon:recon@localhost:5434/recon") {
  const pool = new Pool({ connectionString: url, max: 5 });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

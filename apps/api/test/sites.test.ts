import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { login, makeTestApp } from "./helpers";
import { site } from "../src/db/schema";

describe("sedes CRUD (REQ-SEDE)", () => {
  let ctx: Awaited<ReturnType<typeof makeTestApp>>;

  beforeAll(async () => {
    ctx = await makeTestApp();
  });

  afterAll(async () => {
    await ctx?.pool?.end();
  });

  it("sin sesión → 401", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/sites" });
    expect(res.statusCode).toBe(401);
  });

  it("supervisor no puede crear sedes (403)", async () => {
    const cookies = await login(ctx.app, "supervisor@test.local", ctx.ADMIN_PASSWORD);
    const res = await ctx.app.inject({
      method: "POST",
      url: "/sites",
      cookies,
      payload: { name: "Sede supervisada" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin crea, lista, consulta y edita una sede", async () => {
    const cookies = await login(ctx.app, "admin@test.local", ctx.ADMIN_PASSWORD);

    const created = await ctx.app.inject({
      method: "POST",
      url: "/sites",
      cookies,
      payload: { name: "Surquillo", address: "Av. principal 123" },
    });
    expect(created.statusCode).toBe(201);
    const sede = created.json();
    expect(sede.id).toBeDefined();
    expect(sede.active).toBe(true);

    const list = await ctx.app.inject({ method: "GET", url: "/sites", cookies });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((s: { id: string }) => s.id === sede.id)).toBe(true);

    const one = await ctx.app.inject({ method: "GET", url: `/sites/${sede.id}`, cookies });
    expect(one.json().name).toBe("Surquillo");

    const patched = await ctx.app.inject({
      method: "PATCH",
      url: `/sites/${sede.id}`,
      cookies,
      payload: { name: "Surquillo II", active: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ name: "Surquillo II", active: false });

    // desactivar no borra: la fila sigue existiendo (REQ-SEDE-01)
    const still = await ctx.db.select().from(site).where(eq(site.id, sede.id));
    expect(still).toHaveLength(1);
  });

  it("datos inválidos → 400 y sede desconocida → 404", async () => {
    const cookies = await login(ctx.app, "admin@test.local", ctx.ADMIN_PASSWORD);

    const bad = await ctx.app.inject({
      method: "POST",
      url: "/sites",
      cookies,
      payload: { name: "" },
    });
    expect(bad.statusCode).toBe(400);

    const missing = await ctx.app.inject({
      method: "GET",
      url: `/sites/00000000-0000-4000-8000-000000000000`,
      cookies,
    });
    expect(missing.statusCode).toBe(404);
  });
});

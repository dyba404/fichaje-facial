import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { login, makeTestApp } from "./helpers";

describe("auth (ADR-0006)", () => {
  let ctx: Awaited<ReturnType<typeof makeTestApp>>;

  beforeAll(async () => {
    ctx = await makeTestApp();
  });

  afterAll(async () => {
    await ctx?.pool?.end();
  });

  it("rechaza credenciales malas con 401", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@test.local", password: "incorrecta" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("login ok establece sesión y /auth/me la refleja", async () => {
    const loginRes = await ctx.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@test.local", password: ctx.ADMIN_PASSWORD },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toContain("admin@test.local");
    expect(loginRes.body).toContain('"admin"');

    const cookieObj = Object.fromEntries(loginRes.cookies.map((c) => [c.name, c.value]));
    const me = await ctx.app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: cookieObj,
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("admin@test.local");
  });

  it("/auth/me sin sesión → 401", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("logout deja la sesión vacía (cookie stateless: lo que se vacía es la nueva cookie, no la vieja)", async () => {
    const cookies = await login(ctx.app, "admin@test.local", ctx.ADMIN_PASSWORD);
    const logoutRes = await ctx.app.inject({ method: "POST", url: "/auth/logout", cookies });
    expect(logoutRes.statusCode).toBe(200);

    // la cookie NUEVA emitida por logout ya no autentica (sesión vacía)
    const freshCookies = Object.fromEntries(logoutRes.cookies.map((c) => [c.name, c.value]));
    const me = await ctx.app.inject({ method: "GET", url: "/auth/me", cookies: freshCookies });
    expect(me.statusCode).toBe(401);
  });
});

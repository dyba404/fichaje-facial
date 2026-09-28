// Siembra datos de DEMO hablando SOLO por HTTP con la API real (sin tocar BD):
// login admin → sede → 2 empleados enrolados con fixtures sintéticas → device.
// Uso: node scripts/demo-seed.mjs   (API debe estar corriendo en :3000)

const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@recon.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "recon-admin-2026";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixture = (p, f) => join(root, "apps", "api", "test", "fixtures", `persona-${p}`, f);
const FOTOS = ["01-original.jpg", "02-rotada-derecha.jpg", "03-rotada-oscura.jpg", "04-contraluz-claro.jpg", "05-encuadre-cerca.jpg"];

let cookie = "";
async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...(cookie ? { cookie } : {}) },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return res;
}

const login = await api("/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) throw new Error(`login falló: ${login.status}`);
console.log("✓ login admin");

const sites = await (await api("/sites")).json();
let site = sites[0];
if (!site) {
  site = await (await api("/sites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Sede principal" }) })).json();
  console.log("✓ sede creada:", site.name);
} else {
  console.log("✓ sede:", site.name);
}

async function enrolar(nombre, dni, pin, persona) {
  const creado = await (await api("/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: nombre, docNumber: dni, siteId: site.id, pin, consent: true }),
  })).json();
  if (creado.error) return console.log("⚠ empleado", nombre, "→", creado.error);

  const fd = new FormData();
  for (const f of FOTOS) {
    const buf = await readFile(fixture(persona, f));
    fd.append("photos", new Blob([buf], { type: "image/jpeg" }), `${persona}-${f}`);
  }
  const up = await api(`/employees/${creado.id}/face-samples`, { method: "POST", body: fd });
  const upBody = await up.json();
  const ok = upBody.results.filter((r) => r.ok).length;
  if (ok < 5) throw new Error(`solo ${ok}/5 fotos válidas para ${nombre}`);
  const fin = await api(`/employees/${creado.id}/face-samples/finalize`, { method: "POST" });
  if (!fin.ok) throw new Error(`finalize falló para ${nombre}`);
  console.log(`✓ enrolado: ${nombre} (DNI ${dni}, PIN ${pin}) con ${ok} fotos`);
}

await enrolar("Rosa Ccahuana (demo)", "87654321", "2468", 2);
await enrolar("Luis Ramos (demo)", "11223344", "1357", 3);

const dev = await (await api("/devices", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Kiosco seed demo", siteId: site.id }),
})).json();
console.log("✓ device creado:", dev.device.name, "apiKey:", dev.apiKey.slice(0, 8) + "…");
console.log("\nDemo lista en", BASE + "/demo");

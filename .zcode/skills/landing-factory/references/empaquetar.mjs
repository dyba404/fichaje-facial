// Empaquetador: convierte una landing HTML que depende de CDNs en un archivo
// standalone (fotos, Google Fonts y scripts incrustados en base64).
//
// Uso:  node empaquetar.mjs entrada.html salida.html
//
// - <script src="https://...">            -> <script>...contenido...</script>
// - <img src="https://...">               -> <img src="data:...;base64,...">
// - <link rel="stylesheet" href="Google Fonts CSS"> -> <style>@font-face con woff2 en base64</style>
// - <link rel="preconnect">               -> se eliminan (no sirven offline)
//
// Requiere Node 18+. Sin dependencias externas.

import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const cache = new Map();

async function fetchBuffer(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  cache.set(url, buf);
  return buf;
}

function mimeDe(url, buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "wOF2") return "font/woff2";
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "wOFF") return "font/woff";
  if (/\.jpe?g($|\?)/i.test(url)) return "image/jpeg";
  if (/\.png($|\?)/i.test(url)) return "image/png";
  if (/\.woff2($|\?)/i.test(url)) return "font/woff2";
  return "application/octet-stream";
}

async function cssAInline(cssUrl) {
  const css = (await fetchBuffer(cssUrl)).toString("utf8");
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
  let inline = css;
  for (const u of [...new Set(urls)]) {
    const buf = await fetchBuffer(u);
    const dataUri = `data:${mimeDe(u, buf)};base64,${buf.toString("base64")}`;
    inline = inline.split(u).join(dataUri);
  }
  return inline;
}

async function main() {
  const [, , entrada, salida] = process.argv;
  if (!entrada || !salida) { console.error("uso: node empaquetar.mjs entrada.html salida.html"); process.exit(1); }
  let html = fs.readFileSync(entrada, "utf8");
  const base = path.dirname(path.resolve(entrada));

  // 1) <link rel="preconnect"> fuera
  html = html.replace(/[ \t]*<link[^>]+rel="preconnect"[^>]*>\s*\n?/gi, "");

  // 2) hojas de estilo remotas -> <style> inline (con fuentes en base64), atributos en cualquier orden
  const linkTags = [...html.matchAll(/<link[^>]*>/gi)].filter(m => /rel="stylesheet"/i.test(m[0]));
  let nCss = 0;
  for (const m of linkTags) {
    const href = (m[0].match(/href="([^"]+)"/i) || [])[1];
    if (!href || !/^https:/i.test(href)) continue;
    const css = await cssAInline(href);
    html = html.replace(m[0], `<style>\n${css}\n</style>`);
    nCss++;
  }

  // 3) <script src="https://..."> -> inline
  const scripts = [...html.matchAll(/<script[^>]+src="(https:[^"]+)"[^>]*><\/script>/gi)];
  for (const m of scripts) {
    const buf = await fetchBuffer(m[1]);
    html = html.replace(m[0], `<script>\n${buf.toString("utf8")}\n</script>`);
  }

  // 4) <img src="https://..."> y url(...) remotos restantes -> data URI
  const imgs = [...new Set([...html.matchAll(/(https:\/\/images\.pexels\.com\/[^"'\s)]+)/g)].map(m => m[1]))];
  for (const u of imgs) {
    const buf = await fetchBuffer(u);
    const dataUri = `data:${mimeDe(u, buf)};base64,${buf.toString("base64")}`;
    html = html.split(u).join(dataUri);
  }

  // 5) riferencias locales relativas (src="algo.ext") -> base64 también
  const locales = [...new Set([...html.matchAll(/(?:src|href)="((?!https?:|data:|#)[^"]+)"/g)].map(m => m[1]))];
  for (const rel of locales) {
    const f = path.join(base, rel.split("?")[0]);
    if (!fs.existsSync(f)) continue;
    const buf = fs.readFileSync(f);
    html = html.split(`"${rel}"`).join(`"data:${mimeDe(f, buf)};base64,${buf.toString("base64")}"`);
  }

  fs.writeFileSync(salida, html);
  const kb = Math.round(fs.statSync(salida).size / 1024);
  console.log(`OK: ${salida} (${kb} KB) — ${imgs.length} fotos, ${nCss} hojas de estilo, ${scripts.length} scripts incrustados`);
}

main().catch(e => { console.error("FALLO:", e.message); process.exit(1); });

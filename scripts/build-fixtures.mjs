// Genera fixtures de test a partir de rostros SINTÉTICOS (human/samples, MIT):
// 4 personas × 5 variaciones de cámara (original, rotaciones, luz, zoom).
// Simula condiciones de kiosco sin meter rostros de personas reales al repo.
// Uso: node scripts/build-fixtures.mjs   (idempotente, borra y regenera)

import sharp from "sharp";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "repos-ref", "human", "samples", "in");
const outDir = join(root, "apps", "api", "test", "fixtures");

const PERSONAS = ["cgi-model-1", "cgi-model-2", "cgi-model-3", "cgi-model-4"];

async function variaciones(src, out) {
  const m = await sharp(src).metadata();
  const cw = Math.round(m.width * 0.7);
  const ch = Math.round(m.height * 0.7);

  await sharp(src).jpeg({ quality: 90 }).toFile(join(out, "01-original.jpg"));
  await sharp(src)
    .rotate(5, { background: "#7a7a7a" })
    .jpeg({ quality: 88 })
    .toFile(join(out, "02-rotada-derecha.jpg"));
  await sharp(src)
    .rotate(-6, { background: "#7a7a7a" })
    .modulate({ brightness: 0.72, saturation: 0.85 })
    .jpeg({ quality: 85 })
    .toFile(join(out, "03-rotada-oscura.jpg"));
  await sharp(src)
    .modulate({ brightness: 1.3, saturation: 0.9 })
    .jpeg({ quality: 88 })
    .toFile(join(out, "04-contraluz-claro.jpg"));
  await sharp(src)
    .extract({ left: Math.round(m.width * 0.15), top: Math.round(m.height * 0.08), width: cw, height: ch })
    .resize(640)
    .jpeg({ quality: 88 })
    .toFile(join(out, "05-encuadre-cerca.jpg"));
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let n = 0;
for (const [i, persona] of PERSONAS.entries()) {
  const out = join(outDir, `persona-${i + 1}`);
  await mkdir(out, { recursive: true });
  await variaciones(join(srcDir, `${persona}.jpg`), out);
  n += 5;
  console.log(`persona-${i + 1} (${persona}): 5 variaciones`);
}

await writeFile(
  join(outDir, "README.md"),
  `# Fixtures de test

Generadas por \`scripts/build-fixtures.mjs\` con rostros SINTÉTICOS (vladmandic/human, MIT):
4 personas × 5 variaciones de cámara (original, ±5-6°, luz baja, contraluz, zoom).

Gitignored (constitution §5 y ADR-0002). Para calibración definitiva con fotos
reales del dueño/empleados, reemplazar contenido y correr de nuevo los tests
de distancias doradas (packages/vision/test/golden.test.ts).
`,
);

console.log(`\n${n} fixtures generadas en ${outDir}`);

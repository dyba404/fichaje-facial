// Distancias doradas del pipeline con las fixtures de test (task 1.6):
//   - MISMA persona (variaciones de cámara): similitud ≥ 0.5
//   - PERSONA distinta: similitud < 0.25
// Si un día se reemplazan las fixtures por fotos reales de empleados, este
// test ES la calibración de umbrales (constitution §2: ajuste genera ADR).

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { VisionEngine, cosine } from "../src/index";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixturesDir = join(repoRoot, "apps", "api", "test", "fixtures");
const hasModels = existsSync(join(repoRoot, "models", "det_10g.onnx")) && existsSync(fixturesDir);

describe.skipIf(!hasModels)("distancias doradas del enrolamiento", () => {
  let engine: VisionEngine;
  /** persona → embedding promedio (como guardará el sistema al finalizar enrolamiento) */
  const centroids = new Map<string, Float32Array>();
  /** persona → embedding por variación */
  const all = new Map<string, Float32Array[]>();

  beforeAll(async () => {
    engine = await VisionEngine.load();
    const personas = (await readdir(fixturesDir)).filter((d) => d.startsWith("persona-")).sort();
    for (const persona of personas) {
      const files = (await readdir(join(fixturesDir, persona))).filter((f) => f.endsWith(".jpg")).sort();
      const vectors: Float32Array[] = [];
      for (const f of files) {
        const raw = await engine.decode(await readFile(join(fixturesDir, persona, f)));
        const faces = await engine.detectFromRaw(raw);
        if (faces.length !== 1) throw new Error(`${persona}/${f}: ${faces.length} caras (se esperaba 1)`);
        vectors.push(await engine.embedFromRaw(raw, faces[0]!));
      }
      all.set(persona, vectors);
      const centroid = new Float32Array(512);
      for (const v of vectors) for (let i = 0; i < 512; i++) centroid[i]! += v[i]!;
      for (let i = 0; i < 512; i++) centroid[i] = centroid[i]! / vectors.length;
      centroids.set(persona, l2(centroid));
    }
  }, 300_000);

  it("MISMA persona: cada variación matchea contra su centroide ≥ 0.5", () => {
    let worst = { pair: "", sim: 1 };
    for (const [persona, vectors] of all) {
      const c = centroids.get(persona)!;
      vectors.forEach((v, i) => {
        const sim = cosine(v, c);
        if (sim < worst.sim) worst = { pair: `${persona}#var-${i + 1}`, sim };
      });
    }
    console.log(`[dorado] PEOR par misma persona: ${worst.pair} = ${worst.sim.toFixed(4)}`);
    expect(worst.sim).toBeGreaterThanOrEqual(0.5);
  });

  it("PERSONA distinta: centroides cruzados < 0.25", () => {
    const personas = [...centroids.keys()];
    let worst = { pair: "", sim: -1 };
    for (let i = 0; i < personas.length; i++) {
      for (let j = i + 1; j < personas.length; j++) {
        const sim = cosine(centroids.get(personas[i]!)!, centroids.get(personas[j]!)!);
        if (sim > worst.sim) worst = { pair: `${personas[i]}↔${personas[j]}`, sim };
      }
    }
    console.log(`[dorado] PEOR par personas distintas: ${worst.pair} = ${worst.sim.toFixed(4)}`);
    expect(worst.sim).toBeLessThan(0.25);
  });

  it("margen de separación: el umbral 0.38 cae entre ambas nubes", () => {
    const same = Math.min(
      ...[...all.entries()].flatMap(([p, vs]) => vs.map((v) => cosine(v, centroids.get(p)!))),
    );
    const personas = [...centroids.keys()];
    const diff = Math.max(
      ...personas.flatMap((p, i) =>
        personas.slice(i + 1).map((q) => cosine(centroids.get(p)!, centroids.get(q)!)),
      ),
    );
    console.log(`[dorado] nube misma-persona ≥ ${same.toFixed(4)} | nube distinta ≤ ${diff.toFixed(4)} | umbral 0.38 en medio`);
    expect(diff).toBeLessThan(0.32); // ni siquiera toca el umbral de ambigüedad
    expect(0.32).toBeLessThan(same);
  });
});

function l2(v: Float32Array): Float32Array {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
}

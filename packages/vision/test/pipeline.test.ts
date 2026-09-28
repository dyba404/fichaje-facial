// Smoke del pipeline con rostros sintéticos (human/samples, sin personas
// reales). Las distancias doradas con fotos de los empleados llegan con la
// tarea 0.6 (fixtures del dueño). Se salta si aún no hay modelos descargados.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { VisionEngine, cosine } from "../src/index";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const hasModels = existsSync(join(repoRoot, "models", "det_10g.onnx"));
const sample = (name: string) => join(repoRoot, "repos-ref", "human", "samples", "in", name);

describe.skipIf(!hasModels)("pipeline SCRFD→align→ArcFace→coseno (rostros sintéticos)", () => {
  let engine: VisionEngine;

  beforeAll(async () => {
    engine = await VisionEngine.load();
  }, 180_000);

  it("detecta exactamente 1 cara con 5 landmarks", async () => {
    const faces = await engine.detect(await readFile(sample("cgi-model-1.jpg")));
    expect(faces).toHaveLength(1);
    expect(faces[0]!.kps).toHaveLength(5);
    expect(faces[0]!.score).toBeGreaterThan(0.5);
  }, 60_000);

  it("embedding es 512-d y la misma imagen auto-matchea ≈1", async () => {
    const img = await readFile(sample("cgi-model-1.jpg"));
    const raw = await engine.decode(img);
    const face = (await engine.detectFromRaw(raw))[0]!;
    const e1 = await engine.embedFromRaw(raw, face);
    const e2 = await engine.embedFromRaw(raw, face);
    expect(e1).toHaveLength(512);
    const selfSim = cosine(e1, e2);
    console.log(`[pipeline] auto-similitud (misma imagen): ${selfSim.toFixed(4)}`);
    expect(selfSim).toBeGreaterThan(0.95);
  }, 60_000);

  it("dos personas distintas quedan BAJO el umbral de match (0.38)", async () => {
    const rawA = await engine.decode(await readFile(sample("cgi-model-1.jpg")));
    const rawB = await engine.decode(await readFile(sample("cgi-model-2.jpg")));
    const faceA = (await engine.detectFromRaw(rawA))[0]!;
    const faceB = (await engine.detectFromRaw(rawB))[0]!;
    const eA = await engine.embedFromRaw(rawA, faceA);
    const eB = await engine.embedFromRaw(rawB, faceB);
    const sim = cosine(eA, eB);
    console.log(`[pipeline] similitud entre personas distintas: ${sim.toFixed(4)}`);
    expect(sim).toBeLessThan(0.38);
  }, 60_000);

  it("recognize end-to-end en CPU responde en < 1.5 s", async () => {
    const img = await readFile(sample("cgi-model-1.jpg"));
    const gallery = [{ id: "persona-1", vector: new Float32Array(512).fill(0.044) }]; // 0.044 ≈ 1/sqrt(512)
    const t0 = performance.now();
    const out = await engine.recognize(img, gallery);
    const ms = performance.now() - t0;
    console.log(`[pipeline] recognize end-to-end: ${ms.toFixed(0)} ms`);
    expect(out.face).not.toBeNull();
    expect(out.embedding).not.toBeNull();
    expect(ms).toBeLessThan(1500);
  }, 60_000);
});

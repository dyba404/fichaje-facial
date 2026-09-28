// VisionEngine: orquesta sharp (decode RGB), SCRFD (detección), alineación y
// ArcFace (embedding 512-d L2) sobre onnxruntime-node. Sin HTTP, sin BD —
// el motor puro es testear por separado (design.md, ADR-0004).

import { InferenceSession, Tensor } from "onnxruntime-node";
import sharp from "sharp";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { alignFace, ALIGNED_SIZE, type RawImage } from "./align";
import { l2Normalize } from "./math";
import { decodeScrfd, type Face, type ScrfdOptions } from "./scrfd";

export interface EngineOptions extends ScrfdOptions {
  modelsDir?: string;
  detWidth?: number; // 640
}

const DET_SIZE = 640;

export interface RecognizeHit {
  id: string;
  similarity: number;
}

export interface RecognizeOutcome {
  face: Face | null;
  /** embedding L2 del rostro alineado (null si no hay cara) */
  embedding: Float32Array | null;
  /** mejor y segundo mejor del gallery (para la regla de ambigüedad) */
  best: RecognizeHit | null;
  second: RecognizeHit | null;
}

export class VisionEngine {
  private det!: InferenceSession;
  private rec!: InferenceSession;
  private detName!: string;
  private recName!: string;
  private opts: EngineOptions = {};

  static async load(opts: EngineOptions = {}): Promise<VisionEngine> {
    const modelsDir = opts.modelsDir ?? defaultModelsDir();
    await assertFile(join(modelsDir, "det_10g.onnx"));
    await assertFile(join(modelsDir, "w600k_r50.onnx"));

    const engine = new VisionEngine();
    engine.opts = opts;
    // sesiones creadas al arranque (skill face-recog: nunca por request);
    // executionProviders default: CPU (win32, sin GPU garantizada)
    engine.det = await InferenceSession.create(join(modelsDir, "det_10g.onnx"));
    engine.rec = await InferenceSession.create(join(modelsDir, "w600k_r50.onnx"));
    engine.detName = engine.det.inputNames[0]!;
    engine.recName = engine.rec.inputNames[0]!;
    return engine;
  }

  /** Decodifica JPEG/PNG a RGB crudo. */
  async decode(image: Uint8Array): Promise<RawImage> {
    const { data, info } = await sharp(Buffer.from(image))
      .flatten({ background: "#000000" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
  }

  /** Detección de caras en coordenadas de la imagen original. */
  async detectFromRaw(raw: RawImage): Promise<Face[]> {
    const w = this.opts.detWidth ?? DET_SIZE;
    const detRaw = await sharp(Buffer.from(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength), {
      raw: { width: raw.width, height: raw.height, channels: 3 },
    })
      .resize(w, w, { fit: "fill" })
      .raw()
      .toBuffer();

    const chw = new Float32Array(3 * w * w);
    const plane = w * w;
    for (let i = 0; i < plane; i++) {
      chw[i] = (detRaw[i * 3]! - 127.5) / 128; // R
      chw[plane + i] = (detRaw[i * 3 + 1]! - 127.5) / 128; // G
      chw[2 * plane + i] = (detRaw[i * 3 + 2]! - 127.5) / 128; // B
    }

    const out = await this.det.run({
      [this.detName]: new Tensor("float32", chw, [1, 3, w, w]),
    });

    const faces = decodeScrfd(
      this.det.outputNames,
      this.det.outputNames.map((n) => out[n]!.data as Float32Array),
      w,
      w,
      this.opts,
    );

    // re-escalar de 640×640 a la imagen original (resize fit:"fill")
    const sx = raw.width / w;
    const sy = raw.height / w;
    for (const f of faces) {
      f.box = [f.box[0] * sx, f.box[1] * sy, f.box[2] * sx, f.box[3] * sy];
      for (const p of f.kps) {
        p[0] *= sx;
        p[1] *= sy;
      }
    }
    return faces;
  }

  async detect(image: Uint8Array): Promise<Face[]> {
    return this.detectFromRaw(await this.decode(image));
  }

  /** Embedding ArcFace 512-d L2-normalizado de una cara detectada. */
  async embedFromRaw(raw: RawImage, face: Face): Promise<Float32Array> {
    const input = alignFace(raw, face);
    const out = await this.rec.run({
      [this.recName]: new Tensor("float32", input, [1, 3, ALIGNED_SIZE, ALIGNED_SIZE]),
    });
    const first = this.rec.outputNames[0]!;
    return l2Normalize(out[first]!.data as Float32Array);
  }

  /**
   * Flujo del kiosco: detecta, alinea, embebe y matchea contra la galería.
   * Devuelve top-1 y top-2 para la regla de ambigüedad (REQ-REC).
   */
  async recognize(
    image: Uint8Array,
    gallery: ReadonlyArray<{ id: string; vector: Float32Array }>,
  ): Promise<RecognizeOutcome> {
    const raw = await this.decode(image);
    const faces = await this.detectFromRaw(raw);
    const face = faces[0] ?? null;
    if (!face) return { face: null, embedding: null, best: null, second: null };

    const embedding = await this.embedFromRaw(raw, face);
    const hits = gallery
      .map((g) => ({ id: g.id, similarity: dot(embedding, g.vector) }))
      .sort((a, b) => b.similarity - a.similarity);
    return {
      face,
      embedding,
      best: hits[0] ?? null,
      second: hits[1] ?? null,
    };
  }
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i]! * b[i]!;
  return s;
}

async function assertFile(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(
      `Falta ${path}. Ejecutar "npm run models:download" (scripts/download-models.ps1, ADR-0002).`,
    );
  }
}

/** models/ en la raíz del repo, resuelto desde este módulo. */
export function defaultModelsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "models");
}

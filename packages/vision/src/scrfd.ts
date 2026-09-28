// Decoder de SCRFD (det_10g.onnx): cajas + 5 landmarks, con NMS propio.
// El número de anchors por celda se DERIVA de la forma real de las salidas
// del modelo (K_s / (H·W)), así el decode no depende de constantes internas.

import { iou } from "./math";

export interface Face {
  /** [x1, y1, x2, y2] en coordenadas de la imagen original */
  box: [number, number, number, number];
  score: number;
  /** 5 landmarks [x, y] en coordenadas de la imagen original */
  kps: Array<[number, number]>;
}

const STRIDES = [8, 16, 32] as const;

export interface ScrfdOptions {
  scoreThreshold?: number; // 0.5 default (det_10g: salidas post-sigmoid)
  nmsThreshold?: number; // 0.4 default
  maxFaces?: number; // 10 default
}

/**
 * Decodifica las salidas brutas de det_10g a caras en coordenadas de la
 * imagen de entrada (640×640). Escala a la imagen original aparte.
 */
export function decodeScrfd(
  outputNames: readonly string[],
  outputs: readonly Float32Array[],
  inputW: number,
  inputH: number,
  opts: ScrfdOptions = {},
): Face[] {
  const scoreThreshold = opts.scoreThreshold ?? 0.5;
  const nmsThreshold = opts.nmsThreshold ?? 0.4;
  const maxFaces = opts.maxFaces ?? 10;

  const groups = new Map<number, { s?: Float32Array; b?: Float32Array; k?: Float32Array }>();
  // 1) agrupar por nombre si el export lo trae (score_8, bbox_16, kps_32…)
  outputNames.forEach((name, idx) => {
    const stride = STRIDES.find((s) => name.endsWith(String(s)));
    if (stride === undefined) return;
    const g = groups.get(stride) ?? {};
    if (name.startsWith("score")) g.s = outputs[idx]!;
    else if (name.startsWith("bbox")) g.b = outputs[idx]!;
    else if (name.startsWith("kps")) g.k = outputs[idx]!;
    groups.set(stride, g);
  });

  // 2) fallback posicional: det_10g de buffalo_l exporta nombres numéricos
  //    (448, 471…) con el orden de insightface:
  //    [s8,s16,s32, b8,b16,b32, k8,k16,k32]
  const matched = [...groups.values()].filter((g) => g.s || g.b || g.k).length;
  if (matched < STRIDES.length) {
    groups.clear();
    const fmc = STRIDES.length;
    STRIDES.forEach((stride, i) => {
      groups.set(stride, { s: outputs[i], b: outputs[i + fmc], k: outputs[i + fmc * 2] });
    });
  }

  const faces: Face[] = [];
  for (const stride of STRIDES) {
    const g = groups.get(stride);
    if (!g?.s || !g.b) continue;
    const H = Math.floor(inputH / stride);
    const W = Math.floor(inputW / stride);
    const cells = H * W;
    const K = g.s.length; // g.s viene aplanado (1·K·1)
    const numAnchors = Math.round(K / cells);
    if (numAnchors < 1 || K % cells !== 0) continue;

    // centros de celda cell-major: (h, w) con na repeticiones por celda
    for (let i = 0; i < K; i++) {
      const score = g.s[i]!;
      if (score < scoreThreshold) continue;
      const cell = Math.floor(i / numAnchors);
      const cy = Math.floor(cell / W) * stride;
      const cx = (cell % W) * stride;

      const o = i * 4;
      const l = g.b[o]! * stride;
      const t = g.b[o + 1]! * stride;
      const r = g.b[o + 2]! * stride;
      const b = g.b[o + 3]! * stride;

      const kps: Array<[number, number]> = [];
      if (g.k) {
        const ko = i * 10;
        for (let p = 0; p < 5; p++) {
          kps.push([cx + g.k[ko + p * 2]! * stride, cy + g.k[ko + p * 2 + 1]! * stride]);
        }
      }
      faces.push({
        box: [cx - l, cy - t, cx + r, cy + b],
        score,
        kps,
      });
    }
  }

  // NMS por IoU, conservando mayor score primero
  faces.sort((a, b) => b.score - a.score);
  const kept: Face[] = [];
  for (const f of faces) {
    if (kept.length >= maxFaces) break;
    if (kept.every((k) => iou(k.box, f.box) < nmsThreshold)) kept.push(f);
  }
  return kept;
}

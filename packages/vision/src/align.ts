// Alineación ArcFace: similitud de los 5 landmarks detectados al template
// canónico de 112×112 (insightface), con warp bilinear propio sobre el buffer
// RGB crudo. Omitir este paso hunde el accuracy (skill face-recog).

import { solveSimilarity } from "./math";
import type { Face } from "./scrfd";

/** Template canónico de 5 puntos para el crop 112×112 de ArcFace. */
export const ARCFACE_TEMPLATE: ReadonlyArray<readonly [number, number]> = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

export const ALIGNED_SIZE = 112;

export interface RawImage {
  data: Uint8Array; // RGB, w*h*3
  width: number;
  height: number;
}

/**
 * Genera el tensor CHW 1×3×112×112 ya normalizado ((v−127.5)/127.5) del rostro
 * alineado. Muestreo bilinear con mapeo inverso y convención de centro de
 * píxel (la misma de cv2.warpAffine).
 */
export function alignFace(raw: RawImage, face: Face): Float32Array {
  if (face.kps.length !== 5) {
    throw new Error(`alignFace: se esperaban 5 landmarks, llegaron ${face.kps.length}`);
  }
  const src = face.kps.map(([x, y]) => [x, y] as const);
  const [a, b, tx, ty] = solveSimilarity(src, ARCFACE_TEMPLATE);

  // inversa de [[a,−b],[b,a]] + t  →  det = a²+b²
  const det = a * a + b * b;
  const out = new Float32Array(3 * ALIGNED_SIZE * ALIGNED_SIZE);
  const plane = ALIGNED_SIZE * ALIGNED_SIZE;

  for (let v = 0; v < ALIGNED_SIZE; v++) {
    for (let u = 0; u < ALIGNED_SIZE; u++) {
      // centro del píxel destino → coordenada continua en la fuente
      const du = u + 0.5;
      const dv = v + 0.5;
      const sx = (a * (du - tx) + b * (dv - ty)) / det - 0.5;
      const sy = (-b * (du - tx) + a * (dv - ty)) / det - 0.5;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;

      // bordes: clamp (el crop alineado puede salirse levemente de la imagen)
      const xa = Math.min(Math.max(x0, 0), raw.width - 1);
      const xb = Math.min(Math.max(x0 + 1, 0), raw.width - 1);
      const ya = Math.min(Math.max(y0, 0), raw.height - 1);
      const yb = Math.min(Math.max(y0 + 1, 0), raw.height - 1);

      const i00 = (ya * raw.width + xa) * 3;
      const i01 = (ya * raw.width + xb) * 3;
      const i10 = (yb * raw.width + xa) * 3;
      const i11 = (yb * raw.width + xb) * 3;

      for (let c = 0; c < 3; c++) {
        const p00 = raw.data[i00 + c]!;
        const p01 = raw.data[i01 + c]!;
        const p10 = raw.data[i10 + c]!;
        const p11 = raw.data[i11 + c]!;
        const top = p00 + (p01 - p00) * fx;
        const bottom = p10 + (p11 - p10) * fx;
        const val = top + (bottom - top) * fy;
        out[c * plane + v * ALIGNED_SIZE + u] = (val - 127.5) / 127.5;
      }
    }
  }
  return out;
}

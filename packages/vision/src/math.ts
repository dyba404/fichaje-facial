// Álgebra mínima del pipeline: L2, coseno y similitud (procrustes 2D por
// mínimos cuadrados). Sin dependencias — es parte del "wow técnico" (design.md).

export function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i]! * v[i]!;
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / norm;
  return out;
}

/** similitud coseno: los vectores deben venir L2-normalizados */
export function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i]! * b[i]!;
  return sum;
}

/**
 * Resuelve la transformada de similitud (escala + rotación + traslación, sin
 * reflejo) que mapea src → dst:  u = a*x − b*y + tx ;  v = b*x + a*y + ty.
 * Mínimos cuadrados con ecuaciones normales 4×4 + Gauss con pivoteo.
 * Devuelve [a, b, tx, ty].
 */
export function solveSimilarity(
  src: ReadonlyArray<readonly [number, number]>,
  dst: ReadonlyArray<readonly [number, number]>,
): [number, number, number, number] {
  const n = src.length;
  if (n < 2 || dst.length !== n) throw new Error("solveSimilarity: ≥2 pares de puntos");

  // A^T A (4×4) y A^T b, con filas [x, −y, 1, 0] → u  y  [y, x, 0, 1] → v
  const ata = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const atb = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const [x, y] = src[i]!;
    const [u, v] = dst[i]!;
    // fila 1: [x, −y, 1, 0], rhs u ; fila 2: [y, x, 0, 1], rhs v
    const r1 = [x, -y, 1, 0];
    const r2 = [y, x, 0, 1];
    for (let j = 0; j < 4; j++) {
      atb[j]! += r1[j]! * u + r2[j]! * v;
      for (let k = 0; k < 4; k++) {
        ata[j * 4 + k]! += r1[j]! * r1[k]! + r2[j]! * r2[k]!;
      }
    }
  }

  // Gauss con pivoteo parcial sobre [A | b]
  const m: number[][] = [];
  for (let r = 0; r < 4; r++) {
    m.push([...ata.slice(r * 4, r * 4 + 4), atb[r]!]);
  }
  for (let col = 0; col < 4; col++) {
    let piv = col;
    for (let r = col + 1; r < 4; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[piv]![col]!)) piv = r;
    }
    if (Math.abs(m[piv]![col]!) < 1e-9) throw new Error("solveSimilarity: matriz degenerada");
    if (piv !== col) [m[col], m[piv]] = [m[piv]!, m[col]!];
    for (let r = col + 1; r < 4; r++) {
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= 4; c++) m[r]![c] = m[r]![c]! - f * m[col]![c]!;
    }
  }
  const p = [0, 0, 0, 0];
  for (let r = 3; r >= 0; r--) {
    let s = m[r]![4]!;
    for (let c = r + 1; c < 4; c++) s -= m[r]![c]! * p[c]!;
    p[r] = s / m[r]![r]!;
  }
  return [p[0]!, p[1]!, p[2]!, p[3]!];
}

/** IoU estándar (intersección/unión) entre dos cajas [x1,y1,x2,y2]. */
export function iou(a: readonly number[], b: readonly number[]): number {
  const x1 = Math.max(a[0]!, b[0]!);
  const y1 = Math.max(a[1]!, b[1]!);
  const x2 = Math.min(a[2]!, b[2]!);
  const y2 = Math.min(a[3]!, b[3]!);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a[2]! - a[0]!) * (a[3]! - a[1]!);
  const areaB = (b[2]! - b[0]!) * (b[3]! - b[1]!);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

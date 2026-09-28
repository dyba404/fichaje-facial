// Almacenamiento de fotos de evidencia en disco (design decisión 9):
// data/<subdir>/... — nunca servidas estáticas; el acceso es por endpoint
// autenticado. data/ está gitignored (constitution §5).

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function dataDir(): string {
  return process.env.DATA_DIR ?? join(repoRoot, "data");
}

/** Guarda un archivo bajo data/<subdir>/ y devuelve la ruta relativa. */
export async function savePhoto(subdir: string, name: string, data: Uint8Array): Promise<string> {
  const dir = join(dataDir(), subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${name.replace(/[^\w.-]/g, "_")}`;
  await writeFile(join(dir, filename), data);
  return `${subdir}/${filename}`;
}

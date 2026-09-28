// Carga .env (raíz del repo o del paquete) sin dependencias externas.
// No sobreescribe variables ya presentes en el proceso.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

for (const p of [join(process.cwd(), ".env"), join(process.cwd(), "..", "..", ".env")]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    const key = m?.[1];
    if (key && !(key in process.env)) process.env[key] = m?.[2] ?? "";
  }
  break;
}

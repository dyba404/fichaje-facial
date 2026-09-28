// Singleton del worker de visión (design decisión 8): la API entera comparte
// UN worker con los modelos precargados; se cierra con el onClose de la app.

import { VisionClient } from "@recon/vision";

let client: VisionClient | null = null;
let starting: Promise<VisionClient> | null = null;

export async function vision(): Promise<VisionClient> {
  if (client) return client;
  starting ??= VisionClient.create().then((c) => {
    client = c;
    return c;
  });
  return starting;
}

export async function closeVision(): Promise<void> {
  await client?.close();
  client = null;
  starting = null;
}

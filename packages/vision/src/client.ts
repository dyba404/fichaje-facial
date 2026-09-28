// Cliente main-thread del worker de visión: 1 worker, jobs en FIFO.
// La API nunca corre inferencia en el event loop (design.md decisión 8).

import { Worker } from "node:worker_threads";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VisionOp, VisionResult } from "./worker";
import type { Face } from "./scrfd";
import type { RecognizeOutcome } from "./engine";

interface ResultMessage {
  type: "result";
  id: number;
  ok: boolean;
  value?: VisionResult;
  error?: string;
}

export class VisionClient {
  private worker!: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: VisionResult) => void; reject: (e: Error) => void }>();

  static async create(modelsDir?: string): Promise<VisionClient> {
    const client = new VisionClient();
    const workerPath = join(dirname(fileURLToPath(import.meta.url)), "worker.ts");
    client.worker = new Worker(workerPath, { workerData: { modelsDir } });

    const ready = new Promise<void>((resolve, reject) => {
      client.worker.once("message", (m: { type: string; error?: string }) => {
        if (m.type === "ready") resolve();
        else reject(new Error(m.error ?? "worker de visión no pudo iniciar"));
      });
      client.worker.once("error", (e) => reject(e));
    });

    client.worker.on("message", (m: ResultMessage) => {
      if (m.type !== "result") return;
      const p = client.pending.get(m.id);
      if (!p) return;
      client.pending.delete(m.id);
      if (m.ok && m.value) p.resolve(m.value);
      else p.reject(new Error(m.error ?? "error desconocido del worker"));
    });

    await ready;
    return client;
  }

  run(op: VisionOp): Promise<VisionResult> {
    const id = this.nextId++;
    return new Promise<VisionResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "job", id, op });
    });
  }

  async detect(image: Uint8Array): Promise<Face[]> {
    const r = await this.run({ kind: "detect", image });
    if (r.kind !== "detect") throw new Error(`respuesta ${r.kind} para un job detect`);
    return r.faces;
  }

  async embed(image: Uint8Array): Promise<Float32Array> {
    const r = await this.run({ kind: "embed", image });
    if (r.kind !== "embed") throw new Error(`respuesta ${r.kind} para un job embed`);
    return r.embedding;
  }

  async recognize(
    image: Uint8Array,
    gallery: ReadonlyArray<{ id: string; vector: Float32Array }>,
  ): Promise<RecognizeOutcome> {
    const r = await this.run({ kind: "recognize", image, gallery });
    if (r.kind !== "recognize") throw new Error(`respuesta ${r.kind} para un job recognize`);
    return r.outcome;
  }

  async close(): Promise<void> {
    await this.worker.terminate();
  }
}

// Worker de visión (design decisión 8): mantiene el motor en un hilo aparte
// para que 50-120 ms de inferencia no bloqueen el event loop de la API.
// Protocolo: {type:'init', modelsDir} → {type:'ready'} | {type:'error'}
//            {type:'job', id, op} → {type:'result', id, ok, value|error}
// Los jobs se procesan en SERIE (cola FIFO dentro del worker): el kiosco es
// 1-cara por diseño y el worker no debe interleaving inferencias.

import { parentPort, workerData } from "node:worker_threads";
import { VisionEngine } from "./engine";
import type { RecognizeOutcome } from "./engine";
import type { Face } from "./scrfd";

export type VisionOp =
  | { kind: "detect"; image: Uint8Array }
  | { kind: "embed"; image: Uint8Array } // exige exactamente 1 cara (enrolamiento)
  | {
      kind: "recognize";
      image: Uint8Array;
      gallery: ReadonlyArray<{ id: string; vector: Float32Array }>;
    };

export type VisionResult =
  | { kind: "detect"; faces: Face[] }
  | { kind: "embed"; embedding: Float32Array }
  | { kind: "recognize"; outcome: RecognizeOutcome };

interface JobMessage {
  type: "job";
  id: number;
  op: VisionOp;
}

if (parentPort) {
  const port = parentPort;
  const modelsDir = (workerData as { modelsDir?: string } | undefined)?.modelsDir;

  VisionEngine.load(modelsDir ? { modelsDir } : {})
    .then((engine) => {
      port.postMessage({ type: "ready" });

      let chain: Promise<void> = Promise.resolve();
      port.on("message", (msg: JobMessage) => {
        if (msg.type !== "job") return;
        chain = chain.then(async () => {
          try {
            let value: VisionResult;
            switch (msg.op.kind) {
              case "detect": {
                const faces = await engine.detect(msg.op.image);
                value = { kind: "detect", faces };
                break;
              }
              case "embed": {
                const raw = await engine.decode(msg.op.image);
                const faces = await engine.detectFromRaw(raw);
                if (faces.length !== 1) {
                  throw new Error(`capture_error: ${faces.length} caras detectadas (se requiere exactamente 1)`);
                }
                value = { kind: "embed", embedding: await engine.embedFromRaw(raw, faces[0]!) };
                break;
              }
              case "recognize": {
                const outcome = await engine.recognize(msg.op.image, msg.op.gallery);
                value = { kind: "recognize", outcome };
                break;
              }
            }
            port.postMessage({ type: "result", id: msg.id, ok: true, value });
          } catch (err) {
            port.postMessage({
              type: "result",
              id: msg.id,
              ok: false,
              error: String((err as Error).message ?? err),
            });
          }
        });
      });
    })
    .catch((err) => {
      port.postMessage({ type: "error", error: String((err as Error).message ?? err) });
    });
}

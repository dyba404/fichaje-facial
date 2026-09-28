// API pública de @recon/vision.
// Pipeline: det_10g (SCRFD) → alineación 112×112 → w600k_r50 (ArcFace) → coseno.

export { VisionEngine, defaultModelsDir } from "./engine";
export type { EngineOptions, RecognizeHit, RecognizeOutcome } from "./engine";
export { VisionClient } from "./client";
export type { VisionOp, VisionResult } from "./worker";
export { alignFace, ALIGNED_SIZE, ARCFACE_TEMPLATE } from "./align";
export type { RawImage } from "./align";
export { decodeScrfd } from "./scrfd";
export type { Face, ScrfdOptions } from "./scrfd";
export { cosine, l2Normalize, solveSimilarity, iou } from "./math";

export const VISION_STUB = false;

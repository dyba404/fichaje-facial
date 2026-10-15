# ADR-0001: Stack de visión artificial — Node + onnxruntime (sin Python)

- Estado: **Aceptada** (ratificada en /clarify del change 0001, 2026-09-28: Postgres+pgvector confirmado; la opción SQLite fue ofrecida y descartada)
- Fecha: 2026-09-28
- Decide: humano (fundamento completo en `research/repos-y-vision.md`).

## Contexto

El proyecto necesita reconocimiento facial real (demostrar visión artificial + backend). La máquina de desarrollo es Windows sin Python (solo el stub de la Store), con Node v24, git y npm. Cámara web estándar, demo en oficina. Producto final: kiosco de marcaje en navegador/tablet + backend propio + dashboard.

## Decisión (propuesta)

CV **todo en Node**, sin Python:

1. **Kiosco (navegador):** MediaPipe Tasks Vision (Apache-2.0) con `blaze_face_short_range` para encuadre y detección en vivo (30-60 FPS en GPU), y **liveness activo** (parpadeo/giro de cabeza vía Face Landmarker blendshapes). Envía frame JPEG al backend.
2. **Backend Node:** `onnxruntime-node` (v1.30, binarios precompilados win32, MIT) ejecutando directamente los ONNX de buffalo_l:
   - `det_10g.onnx` (SCRFD) — detección seria con NMS propio.
   - `w600k_r50.onnx` (ArcFace r50) — embedding 512-d tras alineación 112×112 por 5 landmarks.
   - Matching por similitud coseno (L2-normalizado) contra embeddings de empleados; umbral inicial 0.38, ajustable (exigente 0.35-0.40; permisivo 0.45-0.50).
3. **Persistencia:** embeddings + marcajes en Postgres (pgvector para el matching; SQLite solo si la demo lo pide).
4. **Framework backend:** Fastify o Express (decidir en /plan del primer change).

## Alternativas consideradas

- **Python vía uv + FastAPI + insightface/DeepFace:** ecosistema CV maduro y DeepFace da API REST casi gratis, pero requiere instalar Python y la demo deja de ser Node. Plan B documentado (instalar uv sin admin: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`).
- **Híbrido (todo en cliente):** menos control de calidad del embedding si el crop/alineación corren en el cliente; el backend quedaría como CRUD — contrario al objetivo de demostrar backend.

## Consecuencias

- + Sin instalar nada fuera de Node; demo "we built the pipeline ourselves" real (NMS, alineación, matching a mano).
- + ONNX es agnóstico del lenguaje: migrar a Python después no tira el trabajo de modelos.
- − Pre/post-procesado propio (NMS, alineación, normalización): es el mayor riesgo técnico del MVP y también el mayor valor demostrativo.
- − buffalo_l es **no-comercial**: obliga a ADR de migración (YuNet+SFace Apache-2.0 o AdaFace MIT) antes de cobrar por el producto (ver ADR-0002).
- Latencia esperada en CPU: ~3-6 fichajes/s — sobra para un kiosco de una cara.

# Investigación: Reconocimiento facial para fichaje — repos, pipeline, liveness y stack (2026-09)

Para qué sirve: fundamenta el ADR-0001 (stack de visión artificial). Informe crudo de investigación.

RESTRICCIÓN DE ENTORNO: Windows, **sin Python** (solo stub de la Store), Node v24, git, cámara web, demo en oficina.

## 1. Repos open source (estado 2026-09)

Hallazgo clave: los repos "attendance system" son **tutorial-grade** (Tkinter/Flask, LBPH o face_recognition, CSV, sin liveness, sin API). Ninguno vale como arquitectura de referencia; valen como referencia de flujo UX. Los repos serios son las **librerías CV** que se componen.

| Repo | Estrellas | Licencia | Stack | Veredicto |
|---|---|---|---|---|
| ageitgey/face_recognition | ~56.8k | MIT | dlib + Python | Clásico semi-abandonado; dlib duele en Windows (build CMake/VS). Referencia conceptual, evitar en el stack |
| deepinsight/insightface | ~29.9k | Código MIT; **modelos no-comercial** | SCRFD+ArcFace ONNX | La referencia técnica real. Modelos ONNX reutilizables desde Node |
| serengil/deepface | ~23.5k | MIT | Python, TF, API REST | Mejor referencia de arquitectura de app (verificación, umbrales por modelo, REST). Activo (push 2026-09) |
| vladmandic/human | ~3.3k | MIT | TFJS browser+Node | Detección+embedding end-to-end en JS |
| minivision-ai/Silent-Face-Anti-Spoofing | ~1.8k | Apache-2.0 | ONNX ~3MB (MiniFASNet) | El estándar open source de liveness pasivo |
| opencv/opencv_zoo | ~1.1k | **Apache-2.0** | YuNet + SFace ONNX | Alternativa permisiva a buffalo_l |
| Attendance systems (Patelrahul4884 ~831 sin licencia; kmhmubin ~584 MIT; Spidy20 ~299 MIT; FaceOnLive ~191 demo de SDK privado) | — | — | — | Tutorial-grade: ver UX, no código. Evitar como base |

Clones locales en `repos-ref/`: deepface, Silent-Face-Anti-Spoofing, human, opencv_zoo, shadcn-admin (dashboard UI). El repo insightface es pesado — su valor está en el ZIP de modelos, no en el código: https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip (contiene `det_10g.onnx`, `w600k_r50.onnx`, `1k3d68.onnx`, `2d106det.onnx`, `genderage.onnx`).

## 2. Pipeline estándar 2026

1. **Detección:** SCRFD (`det_10g.onnx`) — el detector de facto del ecosistema insightface; MediaPipe BlazeFace si es en navegador. MTCNN/RetinaFace original y Haar/LBPH: obsoletos.
2. **Alineación:** crop alineado por 5 landmarks con transformada de similitud a **112×112** (lo que ArcFace espera; omitirlo hunde el accuracy).
3. **Embedding:** **ArcFace r50 (`w600k_r50.onnx`), 512-d** (WebFace600K). Alternativas: SFace (128-d, OpenCV), AdaFace (512-d, MIT), dlib ResNet (128-d, débil en perfil/luz).
4. **Matching:** similitud coseno sobre embeddings **L2-normalizados** (producto punto = coseno) contra base de embeddings por empleado (promedio + top-k).
5. **Persistencia:** embeddings (blob o pgvector) + tabla de marcajes.

## 3. Anti-spoofing / liveness

- **Pasivo:** Silent-Face-Anti-Spoofing (Apache-2.0, ~3MB, detecta foto/video/pantalla; hay ports ONNX de MiniFASNet ejecutables fuera de Python). Alternativa: OpenPAD. Para producción ligera es lo más realista.
- **Activo:** parpadeo / girar cabeza ante prompt — 100% navegador con MediaPipe Face Landmarker (blendshapes eyeBlink + rotación). Muy efectivo contra foto estática, costo cero de modelos.
- **Demo:** activo en kiosco (2-3 s) + selfie de evidencia. **Producción:** pasivo + activo combinados, umbrales ajustados con propio conjunto de ataques. **buffalo_l NO trae liveness.**

## 4. Stack viable en esta máquina

| Opción | Pros | Contras |
|---|---|---|
| a) Python vía uv + FastAPI + insightface/DeepFace | Ecosistema CV maduro; DeepFace da API REST casi gratis | Instalar Python; la demo deja de ser Node |
| **b) Node puro: onnxruntime-node + ONNX de buffalo_l** ✅ | Sin Python; inferencia CV propia (SCRFD+ArcFace a mano); backend único; ONNX agnóstico del lenguaje | Pre/post-procesado a mano (NMS, align 112×112) — que es justamente el "wow técnico" |
| c) Híbrido navegador+servidor | Liveness fluido en cliente; solo matching en servidor | Menos control de calidad del embedding si el crop es en cliente |

**Recomendación: (b) con toques de (c).** Kiosco en navegador con MediaPipe Tasks Vision (Apache-2.0, `blaze_face_short_range.tflite`, GPU delegate) para encuadre + liveness activo, envía frame JPEG al backend; backend Node (Fastify/Express) con `onnxruntime-node` (v1.30, binaries precompilados win32, MIT) ejecutando det_10g + w600k_r50, matching coseno, Postgres/pgvector (o SQLite para demo). Plan B documentado: instalar Python sin admin con `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"` y luego `uv python install 3.11`.

## 5. Números útiles

- Embedding ArcFace: **512-d**; normalizar L2; producto punto = coseno.
- Umbral coseno: DeepFace usa distancia ≤ 0.68 para ArcFace ⇒ similitud ≥ ~0.32. Práctica con w600k_r50: **0.35-0.40 exigente (recomendado para fichaje), 0.45-0.50 permisivo**. Ajustar con 20-30 pares propios (misma/distinta persona) antes de la demo. Gemelos/familiares: pedir segundo ángulo.
- **Enrolamiento: 5-10 fotos** por empleado (frontal + giros ±20°, con/sin lentes, buena luz); guardar promedio + vectores individuales.
- Latencia CPU: det_10g ~30-60 ms/frame (640×480); w600k_r50 ~50-120 ms/cara → **~3-6 fichajes/s** en CPU; sobra para kiosco. Acelerable con int8 / worker_threads.
- MediaPipe FaceDetector navegador (GPU): BlazeFace sub-milisegundo; 30-60 FPS reales en laptop.

## 6. Licencias del modelo facial

- **buffalo_l: solo investigación no comercial** (código insightface MIT; los pesos no). OK para demo interna; para vender → migrar de modelo.
- Alternativas permisivas: **OpenCV Zoo YuNet + SFace** (Apache-2.0, umbral coseno sugerido 0.363, ONNX listos) y **AdaFace** (MIT, 512-d, mejor en baja resolución, ONNX en HF de la comunidad).
- Ruta pragmática: demo con buffalo_l, swap documentado (ADR) a SFace/AdaFace si se comercializa.

## Fuentes

- https://github.com/deepinsight/insightface · https://github.com/deepinsight/insightface/blob/master/python-package/README.md (licencia modelos) · https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip
- https://github.com/serengil/deepface · tesis Linnaeus (umbral ArcFace 0.68 coseno): https://lnu.diva-portal.org
- https://github.com/minivision-ai/Silent-Face-Anti-Spoofing · https://github.com/iamjosephmj/OpenPAD
- https://github.com/opencv/opencv_zoo · https://github.com/mk-minchul/AdaFace
- https://github.com/vladmandic/human · https://github.com/vladmandic/face-api
- https://registry.npmjs.org/onnxruntime-node/latest · https://developers.google.com/edge/api/mediapipe · https://arxiv.org/abs/1907.05047
- https://docs.astral.sh/uv/getting-started/installation/
- Attendance (referencia UX): Patelrahul4884/Attendance-Management-system-using-face-recognition, kmhmubin/Face-Recognition-Attendance-System, Spidy20/Attendace_management_system, FaceOnLive/Face-Attendance-App-Flutter

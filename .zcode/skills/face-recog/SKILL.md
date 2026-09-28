---
name: face-recog
description: >
  Conocimiento técnico del pipeline de reconocimiento facial de este proyecto
  para tomar decisiones correctas al implementarlo: orden del pipeline
  (SCRFD → alineación 112×112 → ArcFace 512-d → coseno), umbrales de matching,
  enrolamiento, liveness, licencias de modelos y las gotchas de ONNX en Node.
  Usar SIEMPRE al escribir, revisar o depurar código de visión artificial
  (detección, embedding, matching, liveness, enrolamiento), al elegir modelos,
  o al interpretar resultados de reconocimiento. No sirve para UI ni backend
  CRUD.
version: 1.0.0
---

# Pipeline de reconocimiento facial de Sfr

Stack decidido (ADR-0001, ADR-0002 — no re-abrir aquí): Node + `onnxruntime-node`, modelos ONNX de buffalo_l en demo. Fundamento y fuentes: `research/repos-y-vision.md`. Referencias clonadas en `repos-ref/` (deepface, Silent-Face-Anti-Spoofing, human, opencv_zoo).

## El pipeline en orden — no alterar el orden

1. **Detección** — `det_10g.onnx` (SCRFD) en backend. Input 640×480 aprox; salida: cajas + 5 landmarks + scores; NMS propio. En el kiosco (navegador) se usa MediaPipe BlazeFace SOLO para encuadre en vivo, nunca para embedding.
2. **Alineación** — transformada de similitud de los 5 landmarks al crop canónico **112×112**. Es el paso que más gente salta y el que hunde todo si falta. Sin alineación correcta, el embedding es ruido con buen coseno aparente.
3. **Embedding** — `w600k_r50.onnx` (ArcFace r50) → vector **512-d**. Normalizar **L2** siempre; entonces producto punto = similitud coseno.
4. **Matching** — coseno contra la base de embeddings del empleado (guardar promedio + vectores individuales, matchear contra top-k).
5. **Decisión** — similitud ≥ umbral → candidato; liveness OK → marcaje válido.

## Números del proyecto (defaults, no re-inventar)

- Umbral coseno inicial: **0.38** (exigente 0.35-0.40; permisivo 0.45-0.50). Ajustar con 20-30 pares propios de test (misma/distinta persona) — registrar el ajuste como ADR. Referencia externa: DeepFace usa distancia coseno 0.68 para ArcFace.
- Enrolamiento: **5-10 fotos** por empleado (frontal + giros ±20°, con/sin lentes, luz variable). Gemelos/familiares → pedir segundo ángulo o PIN de respaldo.
- Latencia CPU esperada: det ~30-60 ms/frame, embedding ~50-120 ms/cara → 3-6 fichajes/s. Si hace falta, worker_threads o int8 — no optimizar antes de medir.
- MediaPipe en navegador: 30-60 FPS reales (GPU delegate).

## Liveness

- **Demo (MVP): activo** — prompt de parpadeo + giro de cabeza con MediaPipe Face Landmarker blendshapes (eyeBlinkLeft/Right, head rotation), 2-3 s. Cero modelos extra, mata la foto estática.
- **Producción: pasivo + activo** — MiniFASNet ONNX (~3 MB, Apache-2.0) de Silent-Face-Anti-Spoofing en backend, más el activo. Ajustar umbrales con conjunto propio de ataques (foto en pantalla, video, recorte impreso).
- buffalo_l **NO trae liveness**. Ningún marcaje facial sin liveness (constitution §4).

## Gotchas (errores que este proyecto ya decidió evitar)

- No usar dlib/face_recognition en Windows (build CMake/VS, semi-abandonado).
- No confiar en detección/alignment hechos en el cliente para el embedding: el backend re-detecta y re-alinea sobre el frame recibido.
- Los embeddings de modelos distintos NO son compatibles: cambiar de modelo = re-enrolar a todos (ADR-0002).
- buffalo_l es no-comercial: si el código llega a producción pagada sin el swap a YuNet+SFace/AdaFace, es violación de licencia, no detalle técnico.
- Precarga de modelos al arranque del servidor (sesiones onnxruntime), no por request.
- Guardar la foto de evidencia y los datos del match en la misma transacción que el marcaje (auditoría sin huecos).

## Verificación de código CV (regla del proyecto)

Todo cambio en el pipeline se demuestra con fixtures: imagen de prueba → distancias coseno reales impresas (mismo/otro), no solo "pasó el test". Los mocks de reconocimiento solo viven en tests unitarios, nunca en la demo (constitution §8).

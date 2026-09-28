# ADR-0002: Modelo facial — buffalo_l solo para demo, migración antes de cobrar

- Estado: **Propuesta** (confirmar en la primera sesión de /clarify)
- Fecha: 2026-09-28
- Decide: humano.

## Contexto

Los paquetes de modelos de insightface (buffalo_l: SCRFD + ArcFace w600k_r50) son el estándar de calidad del ecosistema open source, pero su licencia es **solo investigación no-comercial** (el código es MIT; los pesos no, por sus datos de entrenamiento anotados). Descarga: https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip

## Decisión (propuesta)

1. Usar buffalo_l durante la fase de demo/validación técnica interna (no se cobra, no se vende).
2. Antes de cualquier uso comercial: migrar a **YuNet + SFace (Apache-2.0, OpenCV Zoo)** o **AdaFace (MIT, 512-d)**, con ADR de migración que registre el re-enrolamiento de empleados (los embeddings no son compatibles entre modelos).
3. El pipeline (detección → alineación 112×112 → embedding → coseno) es idéntico: el swap es de archivos ONNX + re-enrolar + re-ajustar umbral (SFace sugiere 0.363).

## Consecuencias

- + Calidad máxima disponible hoy sin pagar licencia, para validar el producto.
- − Los embeddings enrolados en demo se descartan en la migración (re-enrolamiento de ~minutos por empleado; asumirlo desde el diseño: enrolamiento debe ser self-service y rápido).
- − Riesgo si el demo "interno" se filtra a uso comercial de facto — vigilarlo como decisión consciente, no por accidente.

# Recon — Sistema de fichaje con reconocimiento facial

Fichaje facial para PYMEs peruanas: cero hardware frente al reloj biométrico
(ZKTeco y similares, S/ 1,100-3,500), con anti-fraude visible en cada marcaje.
"El reloj eres tú": el trabajador se marca frente a la cámara del navegador y el
sistema verifica que es él.

El pipeline de visión es **propio y corre en Node puro** (sin Python): detección
SCRFD (`det_10g`) → alineación 112×112 → embeddings ArcFace (`w600k_r50`, 512-d)
→ matching por similitud coseno (umbral 0.38), con `onnxruntime-node`. Verificado
con tests de distancias doradas: auto-similitud 1.0000, personas distintas 0.1685,
~100 ms end-to-end.

## Características

- Marcajes de entrada/salida + refrigerio; fallback por PIN con foto de evidencia.
- Reporte de asistencia en CSV con los campos de SUNAFIL (T-Registro).
- Multi-sede con ABM y filtro.
- API con evidencia fotográfica por marcaje, feed en vivo (SSE) y sync offline.
- Anti-spoofing activo en el kiosco: MediaPipe para encuadre + liveness.

## Arquitectura

```
apps/api        Fastify + Postgres (pgvector): empleados, sedes, marcajes, evidencia y /demo
apps/kiosk      kiosco de marcaje en navegador (en construcción)
apps/dashboard  panel de asistencia (en construcción)
packages/vision pipeline propio: SCRFD → alineación → ArcFace (onnxruntime-node)
packages/core   dominio compartido
decisions/      ADRs: stack CV, licencia del modelo, backend, monorepo, auth, Postgres
```

## Estado

Backend y pipeline de visión verificados con tests golden
(`packages/vision/test/`). Las apps de kiosco y dashboard son stubs por ahora:
la UI real es la fase siguiente; el flujo completo se ve hoy en la página `/demo`
servida por la API. Los modelos ONNX no van en el repo — se descargan con
`npm run models:download` — porque la licencia del pack buffalo_l es no-comercial:
antes de un uso comercial, swap a YuNet+SFace (Apache-2.0) o AdaFace (MIT)
(ver `decisions/0002-modelo-facial-licencia.md`).

## El mercado

- El registro de asistencia es obligación legal en Perú (SUNAFIL, infracción muy
  grave), pero el reloj biométrico no es obligatorio — y el hardware cuesta
  S/ 1,100-3,500.
- Ningún competidor exporta T-Registro nativo ni muestra el anti-fraude. Jibble
  es freemium por usuario; GeoVictoria, cotización cerrada.

## Setup

```bash
docker compose up -d db     # Postgres 16 + pgvector
npm install
npm run models:download     # ONNX: SCRFD + ArcFace (~190 MB)
npm run dev:api             # Fastify; la demo vive en http://localhost:<puerto>/demo
npm test                    # tests del pipeline de visión (distancias doradas)
```

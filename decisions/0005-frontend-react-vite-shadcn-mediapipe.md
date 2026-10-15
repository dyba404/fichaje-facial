# ADR-0005: Frontend — React 19 + Vite + shadcn/ui; kiosco con MediaPipe Tasks Vision

- Estado: Aceptada (2026-09-28, /plan del change 0001)
- Decide: aprobado por el dueño del producto

## Contexto

Dos frontends: dashboard admin (KPIs, feed en vivo, tablas, ABM) y kiosco de marcaje (cámara + liveness + botones grandes). Son apps privadas (LAN / tablet del local), no sites públicos, alineadas a React/Tailwind/shadcn.

## Decisión

- **Dashboard:** React 19 + Vite + Tailwind + shadcn/ui + recharts. Layout del shadcn dashboard example como base; DESIGN.md propio se creará en la fase de UI.
- **Kiosco:** React 19 + Vite; **MediaPipe Tasks Vision (Apache-2.0) self-hosted** (wasm/tflite servidos local, sin CDN — debe funcionar offline): `blaze_face_short_range` para encuadre en vivo y FaceLandmarker con blendshapes para el liveness activo (parpadeo + yaw). El backend re-verifica detección con SCRFD; el cliente nunca decide la identidad.

## Alternativas consideradas

- **Next.js:** SSR/ISR innecesarios para apps privadas; complica el deploy en tablet/local.
- **face-api.js / TFJS:** mantenimiento inferior a MediaPipe Tasks; blendshapes de FaceLandmarker dan el liveness activo casi gratis.
- **Liveness solo en servidor:** más seguro pero exige subir frames continuos; en MVP el compromiso es desafío activo en cliente + re-verificación + registro de scores (riesgo documentado en design.md).

## Consecuencias

+ GPU del cliente para 30-60 FPS: la UX de marcaje en <3 s no depende del CPU del backend.
+ Un solo idioma (TS) y un solo lenguaje visual (shadcn) en dashboard y kiosco.
− Servir los assets de MediaPipe localmente añade ~10-15 MB a `apps/kiosk/public`.
− La confianza en el liveness client-side es limitada: queda explícito como riesgo del MVP, no como secreto.

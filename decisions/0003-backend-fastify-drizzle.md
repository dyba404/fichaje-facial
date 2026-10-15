# ADR-0003: Backend — Fastify + TypeScript strict + Drizzle ORM

- Estado: Aceptada (2026-09-28, /plan del change 0001)
- Decide: aprobado por el dueño del producto

## Contexto

ADR-0001 fijó Node + onnxruntime para el CV; quedaba decidir framework, lenguaje y acceso a datos. El change 0001 exige validación estricta de entrada (frames JPEG, fotos de enrolamiento), REST + SSE, y Postgres con pgvector (columna `vector(512)`), con contrato compartido entre 3 apps.

## Decisión

- **Fastify** (v5) como framework HTTP: validación por JSON Schema/zod nativa, serialización rápida, plugins oficiales (multipart, secure-session, cors).
- **TypeScript strict** en todo el monorepo; schemas zod en `packages/core` como única fuente del contrato API (validan request y tipan response).
- **Drizzle ORM** + drizzle-kit para migraciones: acceso SQL-first, soporte de columna `vector` de pgvector, tipado end-to-end.

## Alternativas consideradas

- **Express:** ecosistema más grande pero validación y TS bolted-on; no aporta nada que Fastify no tenga.
- **NestJS:** DI y ceremonia desproporcionadas para 3 apps pequeñas.
- **Prisma:** runtime más pesado, pgvector requiere configuración extra; el valor (query builder visual) no se usa aquí.
- **Kysely:** buen query builder pero migraciones aparte; Drizzle cubre ambas.

## Consecuencias

+ Contrato único `packages/core` consumido por api, kiosk y dashboard (menos drift).
+ SSE vía plugin (fastify-sse-v2) sin WebSockets.
− Curva menor de plugins Fastify frente a Express; mitigado con docs en el repo.

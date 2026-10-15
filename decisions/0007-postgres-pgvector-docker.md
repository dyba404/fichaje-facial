# ADR-0007: Postgres 16 + pgvector vía docker-compose (fallback: Postgres embebido)

- Estado: Aceptada (2026-09-28, /plan del change 0001 — el dueño confirmó Postgres+pgvector en /clarify y reportó Docker en instalación)
- Decide: humano

## Contexto

El dueño confirmó Postgres + pgvector (ADR-0001). En /plan se descubrió que la máquina no tiene Docker (ni Python ni admin garantizado), y pgvector en Windows nativo exige compilar con Visual Studio Build Tools (~2-3 GB, frágil). El dueño eligió instalar Docker durante el /plan.

## Decisión

- **Dev/demo: docker-compose con imagen `pgvector/pgvector:pg16`** (puerto 5432, volumen `data/pg`). Una sola pieza de infraestructura, reproducible, pgvector precompilado.
- **Fallback documentado si Docker falla al arrancar /build:** paquete npm `embedded-postgres` (binarios zonky win-x64, sin admin) **sin pgvector** — embeddings como bytea y coseno calculado en Node (≤1.000 vectores ≈ microsegundos). La capa de repos queda localizada para este swap; pgvector vuelve como optimización cuando escale (índice HNSW).
- El matching del MVP usa **coseno exacto** con el operador `<=>` (sin índice HNSW: innecesario a esta escala).

## Alternativas consideradas

- **Postgres nativo + pgvector compilado:** cumple literal pero arrastra VS Build Tools y el build C++ más frágil del proyecto; se descarta mientras Docker exista.
- **SQLite:** descartado por el dueño en /clarify (multi-sede y concurrencia de escritura apuntan a Postgres real).

## Consecuencias

+ pgvector real (columna `vector(512)`, `<=>`) desde el día uno; el camino a producción no tiene migración de modelo.
+ El fallback embebido mantiene /build desbloqueado si Docker tarda.
− Requiere que Docker Desktop esté corriendo para desarrollar (task de arranque lo verifica con `docker info`).

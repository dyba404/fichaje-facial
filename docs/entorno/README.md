# docs/entorno — Bitácora de fixes de entorno

Carpeta aparte del loop SDD para documentar problemas de la **máquina de desarrollo** (no del producto): qué pasó, cómo se diagnosticó, qué bugs se encontraron y qué fix se aplicó, con evidencia real.

Convención: un archivo por caso, `YYYY-MM-DD-tema.md`, en español, con comandos y salidas reales copiadas (no reconstruidas).

## Índice

| Fecha | Caso | Estado |
|---|---|---|
| 2026-09-28 | [Docker Desktop no arrancaba: "Virtualization support not detected"](2026-09-28-docker-wsl2.md) | Resuelto |

> Contexto: Docker se necesitaba para el contenedor Postgres+pgvector del change 0001 (ver `changes/0001-*`). Estos fixes son de entorno y no generan ADR ni spec.

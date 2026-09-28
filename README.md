# Sfr — Sistema de Fichaje con Reconocimiento Facial

Workspace **armado para construir el proyecto con IA** (SDD + skills), no para construir a mano. El producto: fichaje facial para PYMEs peruanas — kiosco de marcaje en navegador + backend propio con pipeline de visión artificial real (SCRFD → ArcFace) + dashboard. "El reloj eres tú": cero hardware frente al ZKTeco, anti-fraude visible.

Estado actual: **diseño y plan de trabajo listos, nada construido todavía.** El change 0001 tiene design.md + 7 ADRs + tasks.md (35 tareas en 8 fases). Sigue `/build 0001-mvp-fichaje-reconocimiento`.

## Mapa del workspace

| Ruta | Qué es |
|---|---|
| `AGENTS.md` | Protocolo para agentes: loop SDD, routers de lectura, QA, entorno, prohibiciones |
| `constitution.md` | Principios no negociables (spec antes que código, anti-fraude, sin Python, licencias) |
| `PRODUCT.md` | Producto: usuarios, propósito, posicionamiento, alcance confirmado vs supuesto |
| `.zcode/skills/` | 26 skills: 18 de diseño (traídas del repo UX) + 6 de workflow SDD + 2 de dominio |
| `changes/0001-mvp-fichaje-reconocimiento/` | Primer change, **aprobado** en /clarify (proposal + spec-delta EARS) — sigue `/plan` |
| `specs/` | Verdad viva del sistema por capability (se llena al archivar changes) |
| `decisions/` | ADRs: 0001 stack CV Node+ONNX, 0002 licencia del modelo facial (ambos "Propuesta") |
| `templates/` | Plantillas que las skills copian (proposal, spec-delta, design, tasks, adr) |
| `research/` | 4 informes de investigación (2026-09-28): SDD+skills, repos+visión, SaaS+Perú+dashboards, Jev/System One |
| `repos-ref/` | Repos clonados de referencia: deepface, Silent-Face-Anti-Spoofing, human, opencv_zoo, shadcn-admin |

## Cómo se trabaja (el loop)

```
/spec 0001-mvp-fichaje-reconocimiento        ✅ hecho
/clarify 0001-mvp-fichaje-reconocimiento     ✅ aprobado (2026-09-28)
/plan 0001-mvp-fichaje-reconocimiento        ✅ design.md + ADR-0003..0007 (2026-09-28)
/tasks 0001-mvp-fichaje-reconocimiento       ✅ 35 tareas en 8 fases (2026-09-28)
/build 0001-mvp-fichaje-reconocimiento       ← SIGUIENTE PASO
/verify  →  archive
```

Cada skill sabe dónde vive lo que necesita (`templates/`, `decisions/`, `research/`) y qué manda (`constitution.md`). Los bugs no pasan por el loop.

## Decisiones ya tomadas (/clarify del 2026-09-28)

1. **Producto: `recon`** (wordmark lowercase, confirmado).
2. **Stack CV: Node puro — ADR-0001 ACEPTADA.** `onnxruntime-node` + ONNX de buffalo_l (SCRFD `det_10g` + ArcFace `w600k_r50` 512-d); MediaPipe en el kiosco para encuadre + liveness activo; matching coseno ≥ 0.38. Sin Python en esta máquina.
3. **Postgres + pgvector** confirmado (SQLite fue ofrecido y descartado).
4. **Marcajes:** entrada/salida + refrigerio. **Fallback:** PIN + foto de evidencia. **Reporte:** CSV con campos SUNAFIL.
5. **Alcance:** una empresa, **multi-sede** (ABM de sedes + filtro entran al MVP). Fuera: multi-empresa (SaaS).
6. **Modelo:** buffalo_l solo demo (ADR-0002 sigue en Propuesta); antes de cobrar, swap a YuNet+SFace (Apache-2.0) o AdaFace (MIT).
7. **Jev/TypeSafe AI** verificado ([docs](https://docs.typesafe.ai/concepts/system-one)): decisiones tipadas con probabilidad (System One). No toca el reconocimiento (es CV local y Jev solo acepta texto); candidato v2 para triaje de justificaciones — [research/jev-typesafe-ai.md](research/jev-typesafe-ai.md).

## Por qué este producto (hallazgos clave de research/)

- Registro de asistencia es **obligación legal** en Perú (SUNAFIL, infracción muy grave) pero el reloj biométrico **no** es obligatorio — y cuesta S/ 1,100-3,500. La PYME compra hardware o papeles.
- Ningún competidor exporta T-Registro nativo ni muestra el anti-fraude. Jibble es freemium por usuario; GeoVictoria cotización cerrada.
- El dashboard que vende la demo: KPIs del día + **feed de marcajes en vivo con foto** + tabla de estado.

## Pendientes conscientes

- `/build 0001-mvp-fichaje-reconocimiento` — arranca por la Fase 0 (**siguiente paso**). Necesita: Docker instalado y corriendo, y tu participación en la tarea 0.6 (10-15 fotos reales para fixtures).
- ADR-0002 (modelo facial, hoy en Propuesta) se ratifica al arrancar /build: los modelos se descargan en la tarea 0.4.
- `DESIGN.md` se crea en la fase de UI (con `taste` + `impeccable init`), no antes.
- Si Jev entra en v2: verificar precio/SLA de la API y existencia de SDK Node (research/jev-typesafe-ai.md).

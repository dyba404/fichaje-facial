---
name: spec
description: >
  Inicia un cambio de feature en este proyecto: crea changes/<slug>/ con
  proposal.md y spec-delta.md (requisitos EARS) a partir de lo que el usuario
  describe y de specs/ vigentes. Usar cuando el usuario quiera especificar,
  proponer o definir una funcionalidad, diga "/spec", o empiece a describir
  algo nuevo que construir ("necesito que...", "agregar...", "qué tal si...").
  No implementar nada: esta skill solo produce la propuesta para revisión.
  Para bugs y ajustes triviales NO usar esto: arreglar directo.
version: 1.0.0
user-invocable: true
argument-hint: <slug-de-la-feature>
---

# /spec — proponer un cambio

## Antes de escribir una línea

1. Leer `constitution.md` (manda sobre todo) y `PRODUCT.md`.
2. Recorrer `specs/` completa: un requisito que ya existe no se re-agrega, se modifica (delta MODIFIED).
3. Si el usuario pidió `/spec` sin slug, derivar slug kebab-case corto del tema (p.ej. `kiosco-liveness-activo`).

## Producir

Crear `changes/<slug>/` copiando `templates/proposal.md` y `templates/spec-delta.md`, y completarlos:

- **proposal.md**: por qué, qué cambia, fuera de alcance explícito. Cada dato no confirmado por el humano va a "Preguntas abiertas", nunca se inventa (regla de PRODUCT.md: "sin confirmar — no inventar").
- **spec-delta.md**: requisitos en EARS (`WHEN ... THE SYSTEM SHALL ...`), cada uno individualmente testeable, id `REQ-<CAP>-NN` donde `<CAP>` es la capability (p.ej. `REQ-KIO-01`). Escenarios GIVEN/WHEN/THEN para los casos no obvios. Incluir al menos un escenario de error/edge por requisito crítico (qué pasa si la cámara falla, si la red se corta, si la cara no matchea).

## Cerrar

Listar las preguntas abiertas en el chat (máx. las 5 de mayor impacto) y sugerir `/clarify <slug>` como siguiente paso. Estado del proposal: `borrador`.

No generar design.md ni tasks.md — eso es /plan y /tasks.

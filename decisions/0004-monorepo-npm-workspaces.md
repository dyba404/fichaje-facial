# ADR-0004: Monorepo npm workspaces

- Estado: Aceptada (2026-09-28, /plan del change 0001)
- Decide: agente (ratificado por el dueño al aprobar el design)

## Contexto

El MVP tiene tres apps (api, kiosk, dashboard) y dos piezas compartidas (contrato API, pipeline de visión). Node 24 + npm 11 instalados; no hay pnpm ni turborepo.

## Decisión

Monorepo con **npm workspaces**:

```
apps/api · apps/kiosk · apps/dashboard
packages/core (tipos + zod) · packages/vision (pipeline ONNX)
```

Un `package.json` raíz, un lockfile, `npm run dev` por workspace y scripts compuestos.

## Alternativas consideradas

- **pnpm + Turborepo:** más rápido y con caché de build, pero instala otra toolchain para una escala que no la necesita.
- **Repos separados:** rompería el contrato compartido y multiplicaría el boilerplate de sync.

## Consecuencias

+ `packages/vision` queda aislado como el "motor CV" demostrable por separado (test unitario del pipeline sin HTTP).
+ El día que escale, migrar a pnpm/turbo es mecánico.
− Installs algo más lentos que pnpm (irrelevante a esta escala).

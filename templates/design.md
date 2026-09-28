# Design: <slug>

Solo si el change tiene decisiones técnicas. Respetar constitution.md; cada decisión relevante genera ADR en `decisions/`.

## Objetivo técnico

<Qué debe lograr la implementación, traducción técnica del spec-delta.>

## Arquitectura

<Dónde vive cada pieza (kiosco / backend / dashboard / BD), con un diagrama simple si ayuda.>

## Modelos de datos

<Tablas/entidades nuevas o modificadas, campos clave, índices. Migraciones necesarias.>

## Decisiones técnicas

| # | Decisión | Alternativas | Por qué |
|---|----------|--------------|---------|

→ Cada fila con peso se registra como `decisions/NNNN-<slug>.md`.

## Riesgos y mitigaciones

<Riesgo → cómo se detecta → qué se hace si pasa.>

## Testing

<Qué se testea por criterio EARS: test automatizado, verificación manual, o evidencia de navegador (screenshots según protocolo AGENTS.md).>

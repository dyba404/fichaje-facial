---
name: clarify
description: >
  Convierte un cambio borrador en algo aprobado: revisa changes/<slug>/,
  hace SOLO las preguntas de alto impacto que bloquean el diseño (las que
  cambian arquitectura, alcance o requisitos), registra las respuestas del
  usuario en proposal.md y actualiza el spec-delta. Usar cuando el usuario
  diga "/clarify", pida aclarar/resolver preguntas de una propuesta, o cuando
  se esté por pasar a /plan con preguntas abiertas sin responder. No
  rediseñar ni ampliar alcance: solo eliminar ambigüedad.
version: 1.0.0
user-invocable: true
argument-hint: <slug>
---

# /clarify — eliminar ambigüedad antes de planear

1. Leer `changes/<slug>/proposal.md` y `spec-delta.md` completos, más `constitution.md` y `PRODUCT.md` para no preguntar lo que ya está decidido ahí.
2. Armar la lista corta de preguntas bloqueantes: las que si quedan mal respondidas obligan a rehacer design o tasks. Descartar las que tienen una respuesta razonable por defecto (proponer el default y pedir solo confirmación). **Máximo 5.** Hacerlas de una vez, numeradas, con opciones cuando existan.
3. Esperar respuestas del humano. No responder por él ni asumir silencio como consentimiento.
4. Registrar cada respuesta en proposal.md bajo "Decisiones" con fecha, moverla fuera de "Preguntas abiertas" (o dejar "Ninguna — se puede pasar a /plan").
5. Si una respuesta cambia requisitos: actualizar `spec-delta.md` en el mismo paso, marcando qué cambió.
6. Si la respuesta toca un principio de constitution.md o una decisión técnica con peso: proponer el ADR que la registre (o recordarle a /plan que lo genere).
7. Cambiar estado a `aclarando` al empezar y `aprobado` cuando el usuario confirme explícitamente la propuesta. Anunciar que sigue `/plan <slug>`.

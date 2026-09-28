---
name: plan
description: >
  Diseña la implementación de un cambio aprobado: genera changes/<slug>/design.md
  (arquitectura, modelos de datos, riesgos, testing) respetando constitution.md
  y los ADRs existentes, y crea ADRs nuevos cuando se toman decisiones técnicas
  con peso. Usar cuando el usuario diga "/plan", pida planear/diseñar cómo se
  implementará una propuesta ya aprobada, o cuando exista un change en estado
  "aprobado" sin design.md. No escribir código de producción: el output es el
  design y los ADRs.
version: 1.0.0
user-invocable: true
argument-hint: <slug>
---

# /plan — diseñar la implementación

1. Leer en orden: `constitution.md` → `decisions/*.md` (los ADRs vinculan decisiones ya tomadas: no re-abrirlas) → `changes/<slug>/proposal.md` (debe estar `aprobado`, sin preguntas abiertas) → `changes/<slug>/spec-delta.md` → skills de dominio aplicables (`face-recog`, `fichaje`) → `research/` si el tema toca lo investigado.
2. Copiar `templates/design.md` a `changes/<slug>/design.md` y completarlo:
   - Arquitectura: qué vive en kiosco / backend / dashboard / BD. Nombrar los módulos reales del repo si ya existe código.
   - Modelos de datos: tablas, campos, índices, migraciones.
   - Decisiones técnicas: tabla decisión/alternativas/por qué. Cada decisión que sobreviva al change genera `decisions/NNNN-<slug>.md` desde `templates/adr.md` (numeración correlativa; estado Aceptada cuando el humano la confirme, Propuesta si espera ratificación).
   - Testing: mapear CADA criterio EARS del delta a su verificación (test automatizado, verificación manual, o evidencia de navegador con el protocolo de AGENTS.md).
3. Chequear anti-objetivos de constitution: nada de Python, no fingir CV, liveness en todo marcaje, datos biométricos tratados como sensibles. Si el diseño los viola, corregir el diseño, no la constitution.
4. Cerrar anunciando `/tasks <slug>`. Si el design revela que el spec estaba mal, volver a /clarify con las preguntas nuevas — no parchar en el design.

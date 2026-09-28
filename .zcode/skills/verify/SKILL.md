---
name: verify
description: >
  Verifica un cambio terminado contra su spec-delta criterio por criterio:
  recorre cada WHEN/THE SYSTEM SHALL, produce evidencia (tests, capturas,
  comandos) y lista divergencias; además compara el resultado contra specs/
  vigentes para detectar drift. Usar cuando el usuario diga "/verify", pida
  verificar/validar/probar una feature construida, o antes de archivar un
  change. No corregir nada: reportar. El fix vuelve por /build.
version: 1.0.0
user-invocable: true
argument-hint: <slug>
---

# /verify — probar contra el spec, no contra la intención

1. Leer `changes/<slug>/spec-delta.md` (fuente de verdad del change), `design.md` (mapa de verificación por criterio) y `specs/` vigente (para drift).
2. Recorrer CADA criterio EARS y producir evidencia:
   - Test automatizado → ejecutarlo y pegar salida real. Prohibido reportar un test que no se corrió en esta sesión.
   - Verificación de navegador → protocolo AGENTS.md: Playwright screenshots (claro/oscuro, 1440×900 y 390×844, anclas relevantes), leer cada captura con la herramienta de imágenes, listar hallazgo → fix → recaptura. Cero falsos positivos.
   - Pipeline CV → casos reales de la carpeta de fixtures del repo: cara enrolada matchea, cara distinta no matchea, foto de pantalla/liveness falla según el criterio. Reportar las distancias coseno obtenidas vs umbral, no solo "pasó".
3. Entregar tabla final: criterio | evidencia (ruta/salida) | resultado (✅/❌/parcial). Divergencias al final con severidad.
4. Chequear drift: ¿la implementación introdujo comportamiento que specs/ no describe? Si sí, proponer delta (nuevo cambio) o corrección — nunca dejar specs/ viejas.
5. Si todo pasa y sin drift: cambiar estado del proposal a `verificado` e instruir el **archive** (el humano lo aprueba): mover `changes/<slug>/` a `changes/archive/YYYY-MM-DD-<slug>/` y fusionar los deltas ADDED/MODIFIED/REMOVED en `specs/`. El archive lo ejecuta el humano o el agente con confirmación explícita.

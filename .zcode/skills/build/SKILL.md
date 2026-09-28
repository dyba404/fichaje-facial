---
name: build
description: >
  Ejecuta la siguiente tarea (o la indicada) del tasks.md de un cambio:
  escribe el código, lo verifica contra su criterio EARS, y solo entonces lo
  tacha. Usar cuando el usuario diga "/build", pida construir/continuar con
  las tareas, o diga "sigue" durante la construcción. Nunca saltar
  verificación, nunca marcar tareas que no se verificaron. No tocar specs/ ni
 constitution.md durante la construcción.
version: 1.0.0
user-invocable: true
argument-hint: <slug> [número-de-tarea]
---

# /build — construir tarea a tarea

1. Leer `changes/<slug>/tasks.md`. Elegir la PRIMERA tarea sin tachar cuyo orden lo permita (respetar dependencias; si el usuario pasó número, validar que sus dependencias estén tachadas). Dejar en el chat qué tarea se toma y qué criterio demuestra.
2. Leer solo lo necesario: design.md, los archivos del repo que la tarea toca, y las skills de dominio aplicables (`face-recog`, `fichaje`).
3. Escribir el código con el estilo del repo existente (sin comentarios que narren lo obvio; nombres en el idioma del dominio: marcaje, tardanza, enrolamiento).
4. **Verificar antes de tachar**, según lo mapeado en design.md: test automatizado, comando con salida observable, o evidencia de navegador (protocolo AGENTS.md: screenshot Playwright claro/oscuro + móvil, leer cada captura, hallazgo → fix → recaptura). Si no se puede verificar, la tarea NO se tacha y se reporta qué falta.
5. Tachar la tarea en tasks.md con una línea de evidencia: `- [x] 1.1 ... → REQ-KIO-01 ✅ <evidencia: comando/ ruta de test / ruta de screenshot>`.
6. Si la implementación revela que el spec o el design estaban mal: PARAR. Reportar la divergencia y proponer volver a /clarify o /plan. Prohibido parchar en silencio.
7. Al agotar las tareas de la fase: reportar estado y sugerir `/verify <slug>`.
8. Al terminar la sesión: resumen de tareas tachadas, evidencias, y la primera tarea pendiente para retomar.

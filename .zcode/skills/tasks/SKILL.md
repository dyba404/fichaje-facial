---
name: tasks
description: >
  Trocea el design de un cambio en tasks.md: checklist numerada de tareas
  atómicas y verificables, ordenadas por dependencia, cada una referenciando
  los criterios EARS que la demuestran. Usar cuando el usuario diga "/tasks",
  pida trocear/tareas/plan de trabajo para un change con design.md completo,
  o cuando /plan haya terminado. No ejecutar tareas: solo producirlas.
version: 1.0.0
user-invocable: true
argument-hint: <slug>
---

# /tasks — trocear en trabajo verificable

1. Leer `changes/<slug>/design.md` y `spec-delta.md`. Si falta design.md, detenerse y decir que corresponde `/plan` primero.
2. Copiar `templates/tasks.md` y producir la checklist:
   - Tareas atómicas: una tarea = un resultado observable verificable (compila, test verde, endpoint responde, screenshot existe). "Implementar reconocimiento" no es una tarea; "det_10g.onnx carga en onnxruntime-node y devuelve 1 caja + 5 landmarks para test.jpg" sí.
   - Orden por dependencia real; marcar `[P]` las paralelizables.
   - Cada tarea referencia `→ REQ-XX-NN` del criterio que la demuestra. Un criterio sin tarea es un agujero; una tarea sin criterio debe justificarse (infra, tooling).
   - Fases que terminen en algo demostrable (Fase 1: pipeline que reconoce a una persona de prueba; Fase 2: kiosco que la usa...).
   - Incluir la sección "Verificación final" del template (recorrido EARS, QA navegador, specs listas para archive).
3. Estimar tamaño relativo por tarea (S/M/L) para detectar tareas L que convenga re-trocear.
4. Cerrar anunciando: se construye con `/build <slug>` (o `/build <slug> 1.1`).

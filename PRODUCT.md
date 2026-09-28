# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (kiosco de marcaje + dashboard admin) con backend propio Node. Nada instalado en el cliente: el kiosco corre en cualquier navegador de tablet/laptop con cámara.

## Stack

confirmado (ADR-0001 aceptada en /clarify, 2026-09-28): Node v24 end-to-end. Visión artificial con `onnxruntime-node` ejecutando modelos ONNX de insightface buffalo_l (SCRFD `det_10g` + ArcFace `w600k_r50` 512-d); kiosco con MediaPipe Tasks Vision para encuadre y liveness activo; backend Fastify/Express; Postgres + pgvector (o SQLite en demo). **Sin Python** (constraint de máquina, ver constitution §3).

## Users

- **Dueño/Admin (usuario principal):** revisa desde su celular quién marcó, tardanzas del día y reportes para planilla/SUNAFIL. No está en el local todo el tiempo.
- **Supervisor de local:** aprueba horas extra y correcciones de marcaje; atiende alertas de fraude o ausencias.
- **Empleado:** marca entrada/salida/refrigerio en el kiosco del local (o desde su propio celular si el dueño lo permite) y consulta sus propios registros. No interactúa con nada más: el marcaje debe tomar menos de 3 segundos.
- *(Sin confirmar)* ¿habrá empleado con celular personal o solo kiosco compartido? Decide el dueño.

## Product Purpose

Sistema de fichaje (control de asistencia) con reconocimiento facial para PYMEs peruanas: el empleado mira una cámara, el sistema lo reconoce y registra el marcaje con foto de evidencia y liveness. Existe para (1) demostrar visión artificial y backend reales — reconocimiento 1:N propio sobre ONNX, no un wrapper de API ajena — y (2) reemplazar el reloj biométrico ZKTeco, que cuesta S/ 1,500-3,500, por una tablet/navegador. Éxito: un marcaje completo (mirar → confirmado) en <3 s con verificación de vida, y un reporte mensual que el dueño puede presentar ante una inspección SUNAFIL sin tocar nada.

## Positioning

"El reloj eres tú": asistencia facial sin hardware, en español, a precio de barrio, con el anti-fraude visible (liveness + foto por marcaje) que los resellers de relojes no muestran. Contra Jibble/GeoVictoria: precio plano por sede (no por usuario), setup self-service en minutos. Contra ZKTeco: cero CAPEX y cero mantenimiento. Mecanismo difícil de copiar: pipeline CV propio (detección SCRFD → alineación 112×112 → embedding ArcFace 512-d → matching coseno) corrido en backend propio, con auditoría anti-fraude como ciudadano de primera clase.

## Operating Context

- Kiosco en la entrada del local: tablet vieja o laptop con cámara USB, luz de local comercial variable (mañana trasera-lit, tarde contraluz posible).
- Oficinas y locales de 5-50 empleados, 1-3 sedes típicas. WiFi doméstico/comercial, cortes de red frecuentes → marcaje debe sobrevivir sin internet (cola local + sync).
- El dueño revisa el dashboard desde el celular a cualquier hora; escritorio para reportes.

## Capabilities and Constraints

- Reconocimiento 1:N sobre la base de empleados enrolados (no verificación 1:1 con tarjeta/PIN como paso obligatorio; PIN es respaldo).
- Enrolamiento con 5-10 fotos por empleado (cámara del kiosco o subida), embedding promedio + vectores individuales.
- Liveness activo en demo (parpadeo/giro ante prompt, MediaPipe blendshapes); pasivo (MiniFASNet ONNX) como fase posterior.
- Registro con los campos exigidos por SUNAFIL: RUC empleador, nombre y DNI del trabajador, fecha con hora/minuto de ingreso/salida y refrigerios (ver research/saas-dashboards.md §2).
- Multi-sede confirmado (2026-09-28, /clarify): una empresa, N sedes — ABM de sedes, asignación empleado-sede, filtro en dashboard y reportes. Sin confirmar (no inventar): turnos rotativos/nocturnos (¿alcance MVP o v2?), vacaciones/ausencias con aprobación, multi-empresa (SaaS), integración T-Registro real vs exportación Excel, marcaje por celular personal del empleado, offline real vs "aviso de que no hay red".

## Brand Commitments

- Nombre del producto: **recon** (wordmark lowercase "recon"). Confirmado por el usuario (2026-09-28, en /clarify del change 0001).
- Voz: español peruano, directo, herramienta de trabajo. Palabras del dominio: marcaje (no "clock-in"), tardanza, refrigerio, enrolamiento.

## Evidence on Hand

- Sin clientes reales aún: todo dato en demos es contenido plausible, no métrica real.
- Investigación de mercado y técnica en `research/` (2026-09-28): competidores, normativa SUNAFIL, umbrales CV, patrones de dashboard.

## Product Principles

1. Marcaje en menos de 3 segundos: si el empleado espera, se hacen cola o se hace trampa.
2. Anti-fraude visible: cada marcaje muestra y guarda POR QUÉ es válido (cara reconocida + liveness + hora + foto). La confianza se demuestra, no se asume.
3. El dueño abre el celular y en 5 segundos sabe quién está presente, quién tardó y quién falta.
4. Falso negativo (no te reconoce) es molestia; falso positivo (reconoce al equivocado) es traición. Los umbrales se inclinan exigentes.
5. Cumplir SUNAFIL es funcionalidad core, no reporte de adorno.

## Accessibility & Inclusion

- Contraste AA en ambos temas; kiosco usable de pie a brazo extendido (targets grandes, texto legible a ~50 cm).
- Reconocimiento justo: enrolamiento con variación de luz/ángulo; manejo documentado de casos difíciles (lentes, barbijo opcional, gemelos → PIN de respaldo).
- `prefers-reduced-motion` respetado; feedback del kiosco no depende solo del color (estado textual + ícono).

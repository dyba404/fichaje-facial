# Investigación: SaaS de asistencia facial, contexto Perú y dashboards (2026-09)

Para qué sirve: fundamenta PRODUCT.md, el alcance de módulos y el diseño del dashboard. Informe crudo de investigación, no tocar como parte del loop.

## 1. SaaS globales con reconocimiento facial

| Producto | Features clave | Pricing aprox. | Diferenciador |
|---|---|---|---|
| **Jibble** | Clock-in facial anti buddy-punching, GPS + geofencing, kiosk tablet, horarios/timesheets, payroll (QuickBooks), apps iOS/Android/web | **Gratis ilimitado**; pago ~USD 2-5/usuario/mes (tier superior ~USD 20); facial/kiosk/geofence en tiers de pago | Freemium más agresivo de la categoría; captura PYEs; UX pulida mobile-first |
| **ZKTeco BioTime 9.x / ZKBio Time** | Software web que centraliza terminales push (ADMS/TCP-IP): facial con liveness (ProFace X, uFace 800), huella, palma, RFID, PIN; turnos, tardanzas, HE, reportes; PostgreSQL on-premise | Sin precio público: licencia por dispositivos vía resellers. Free hasta 2 dispositivos/~120 usuarios; 10 dispositivos ~USD 600+ | Hardware-first: domina terminales biométricos; el software es un anexo. On-premise, servidor Windows |
| **TrackOmeter** | Time clock móvil con selfie facial, GPS continuo de campo, kiosk tablet, timesheets, payroll | Quote-based | Workforce móvil/campo con telemetría GPS |
| ClockIt / ClockInEasy / Timeero / Connecteam | Facial + kiosk + GPS/geofence + offline | ClockInEasy ~USD 4/u/mes; Connecteam desde ~USD 29/mes (30 usuarios) | Facial ya es commodity de precio bajo por usuario |

Enterprise (UKG, Workday) de pasada: no venden facial propio — lo tercerizan en kioscos (M2SYS, CloudApper). La categoría "SaaS facial" es SMB.

## 2. Contexto Perú

- **Obligación legal:** registro de asistencia obligatorio para todo empleador privado (D.S. N° 004-2006-TR / D.S. 001-2006-TR). Debe contener: RUC del empleador, nombre y DNI del trabajador, fecha con **hora y minutos** de ingreso/salida y refrigerios. No acreditarlo es **infracción muy grave** ante SUNAFIL (Res. 506-2021-SUNAFIL/TFL, multas). Marcación posterior admite "razonabilidad" (Res. Sala Plena 011-2024-SUNAFIL/TFL). **El reloj biométrico NO es obligatorio** — es el medio dominante, no el requisito.
- **Hardware dominante:** ZKTeco (uFace 800 Plus ~USD 478+IGV; ProFace X ~S/ 3,369; huelleros desde S/ 110 en Mercado Libre) y Hikvision, vía MaxSecurity, zkperu, Baetech, RHNube. PYME de 20 empleados: reloj de S/ 1,500-3,500 + software de reseller.
- **Lo que pide la PYME peruana:** cumplir ante SUNAFIL, saber quién llegó tarde hoy, calcular HE para planilla (T-Registro/Excel), auditar sin papeles. Español, WhatsApp, bajo CAPEX.
- **Jugadores locales/LatAm:** GeoVictoria (líder regional, Perú desde 2022; selfie + geolocalización + Face ID; ~USD 2.49/u/mes, cotización), XmartClock (app móvil facial+GPS), Rekon People (facial desde cámara del celular, offline, sin hardware), SIA Perú (~USD 250 reloj-tableta), Defontana/Cegid/TOTVS (ERP con facial). **Ninguno específicamente peruano ni barato/simple para PYME de 10-50.**

## 3. Checklist de módulos de la categoría

| Módulo | Features estándar (Jibble, BioTime, GeoVictoria, ClockIt) |
|---|---|
| Enrolamiento | Alta de empleado con foto facial, DNI, multi-dispositivo; re-enrolamiento; detección de duplicados |
| Kiosco/tablet | Modo quiosco: reconocimiento 1:N, PIN de respaldo, foto evidencia por marcaje |
| Geolocalización | GPS en el marcaje, geofencing por sede con radio, IP permitida |
| Offline | Cola local de marcajes + sync al recuperar red |
| Turnos | Fijos/rotativos, jornadas, tolerancias, nocturnos con cruce de medianoche |
| Tardanzas | late-in/early-out automático, tolerancia configurable, acumulados mensuales |
| Horas extra | Diarias/semanales, aprobación de supervisor, exportación a planilla |
| Ausencias | Solicitudes + aprobación, tipos de permiso, calendario de equipo |
| Reportes | Diario/mensual por empleado y sede, tardanzas y HE; **exportación Excel/CSV** (base para T-Registro; ningún SaaS global exporta T-Registro nativo) |
| Notificaciones | Email/push/WhatsApp de tardanzas, ausencias, marcajes faltantes |
| Multi-sucursal | Sedes + asignación empleado-sede-turno; vista consolidada |
| Roles | Admin (todo), supervisor (su sede, aprueba), empleado (self-service) |
| Auditoría/anti-fraude | Liveness, foto en cada marcaje, log inmutable, alerta fuera de geocerca, detección misma cara/dispositivo |

## 4. Patrones de dashboard de asistencia

- **Fila de KPIs**: Presentes hoy, Tardanzas, Ausentes, De vacaciones, % asistencia — con delta vs ayer/semana.
- **Gráfico de llegadas por hora** (barras/área): marcajes 7:00-10:00 vs hora de turno → ver la cola de tardanzas.
- **Heatmap día×sucursal o día×empleado** de presencia/tardanza.
- **Tabla en tiempo real**: foto, nombre, sede, hora de entrada, estado (En turno / Tardanza / Ausente / Fuera de geocerca), badge de color, búsqueda y filtros.
- **Feed de marcajes en vivo**: foto selfie + hora + método + sede — el elemento más "wow" para demo de visión artificial.
- Secundarios: dona por sede, top tardanzas del mes, HE acumuladas, mini-calendario mensual del empleado.
- Referencias de producto: Bold BI HR Attendance, Horilla HRMS (open source), Bromcom, attendance.gov.in.

## 5. Referencias UI open source para el dashboard

1. shadcn/ui Dashboard example (oficial): https://ui.shadcn.com/examples/dashboard
2. arhamkhnz/next-shadcn-admin-dashboard (Next.js 16 + shadcn, MIT): https://github.com/arhamkhnz/next-shadcn-admin-dashboard
3. satnaing/shadcn-admin (clonado en repos-ref/): https://github.com/satnaing/shadcn-admin
4. Tremor (charts para React): https://www.tremor.so

## 6. Oportunidades frente al mercado peruano

1. **Precio contra el reloj, no contra el SaaS:** el huellero barato (S/ 110-1,500) es el competidor real. "El reloj eres tú: tu tablet con cámara" — cero hardware, plan simple por sede (p.ej. S/ 99/mes por sede ilimitada) vs cobro por usuario con cotización cerrada.
2. **Setup en minutos, español y WhatsApp:** enrolamiento por selfie desde un enlace de WhatsApp, kiosco web en cualquier tablet vieja, onboarding self-service. Los rivales venden por cotización con vendedor.
3. **Cumplimiento SUNAFIL como feature:** reporte mensual con campos exigidos (RUC, DNI, fecha con hora/minutos, refrigerios), Excel listo para fiscalización y T-Registro/planilla, evidencia fotográfica por marcaje como "prueba" ante inspección.
4. **Offline-first para Perú real:** marcaje sin datos (cola local + sync), geocerca flexible por sede.
5. **Demo técnica como marketing:** feed en vivo con foto + resultado de liveness, latencia <300 ms, dashboard de auditoría anti-fraude — frente a resellers de ZKTeco que no muestran el "cómo".
6. **Anti-fraude visible:** liveness + geocerca + foto + alerta inmediata al supervisor por WhatsApp.

## Fuentes

- https://www.jibble.io/pricing · https://www.fastlancer.org · https://www.capterra.com · https://www.techjockey.com · https://get.clockit.io/features/apps/facial-recognition-employee-time-tracking
- https://www.zkteco.me · https://cdcsys.co.za · https://www.m2sys.com · https://www.cloudapper.ai
- Perú: https://www.lenoxhr.com/hr-plus/control-asistencia-peru-sunafil · https://maxsecurityperu.com/que-pide-sunafil-control-asistencia-2026 · https://redderrhh.com/red-news/elementos-del-registro-de-control-de-asistencia-en-peru/ · https://softland.com/pe/control-de-asistencia-y-horas-extras-en-peru · https://www.geovictoria.com/es-pe/blog/como-cumplir-con-el-control-de-asistencia-sunafil-nuevos-parametros · https://img.lpderecho.pe/wp-content/uploads/2022/12/Resolucion-506-2021-SUNAFIL-TFL-Primera-Sala-Juris.pe_.pdf
- Hardware Perú: https://www.baetech.pe · https://rhnube.com.pe · https://zkperu.com
- Locales: https://www.xmartclock.com · https://rekonpeople.com · https://www.sia.red
- Dashboards: https://www.boldbi.com/dashboard-examples/hr/attendance-dashboard/ · https://www.horilla.com/blogs/how-to-use-the-attendance-dashboard-components-in-horilla-hrms/ · https://docs.bromcom.com/knowledge-base/how-to-use-the-attendance-dashboard/ · https://attendance.gov.in/
- UI: https://ui.shadcn.com/examples/dashboard · https://github.com/arhamkhnz/next-shadcn-admin-dashboard · https://github.com/satnaing/shadcn-admin · https://www.tremor.so

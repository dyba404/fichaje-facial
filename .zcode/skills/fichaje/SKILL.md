---
name: fichaje
description: >
  Conocimiento del dominio de control de asistencia/fichaje y su normativa
  peruana: campos obligatorios del registro ante SUNAFIL, reglas de negocio de
  marcajes (tardanza, tolerancia, refrigerio, horas extra, cruce de
  medianoche), módulos estándar de la categoría y decisiones de producto ya
  tomadas. Usar SIEMPRE al especificar, diseñar o implementar cualquier
  funcionalidad de marcajes, turnos, reportes, ausencias, roles o
  cumplimiento; también al discutir alcance o precio. No sirve para el
  pipeline de visión artificial (usar face-recog para eso).
version: 1.0.0
---

# Dominio de fichaje (Perú)

## Normativa que el sistema cumple (verificar vigencia ante cambios legales)

- El registro de asistencia es **obligatorio para todo empleador privado** (D.S. N° 004-2006-TR / D.S. 001-2006-TR). El **reloj biométrico NO es obligatorio** — el empleador elige el mecanismo; esto es lo que legitima el producto.
- Campos exigidos en el registro: **RUC del empleador, nombre y DNI del trabajador, fecha con hora y minutos de ingreso/salida y refrigerios**. Un schema de marcaje que no capture esto no cumple.
- No acreditar el registro = **infracción muy grave** ante SUNAFIL (Res. 506-2021-SUNAFIL/TFL, multas). Marcación posterior fuera de hora admite "razonabilidad" (Res. Sala Plena 011-2024-SUNAFIL/TFL).
- Datos biométricos = datos sensibles: consentimiento explícito en enrolamiento (Ley 29733), uso declarado, embedding no sale del backend (constitution §5).

## Reglas de negocio del marcaje (defaults a confirmar en spec)

- Tipos de marcaje: entrada, salida, inicio de refrigerio, fin de refrigerio. Un marcaje correcto cierra el estado anterior; **no** se permite doble entrada sin salida.
- Tardanza: llegada después de la hora de turno + tolerancia configurable (default propuesto: 5 min). Registrar minutos de atraso, no solo el flag.
- Horas extra: salida después de jornada + HE autorizadas por supervisor (en v1: registrar y reportar; la aprobación puede ser v2).
- Cruce de medianoche: el turno nocturno se computa al día de inicio de la jornada.
- Correcciones: el supervisor corrige con motivo y queda TANTO el registro original como la corrección (append-only, constitution §4 — evidencia SUNAFIL).
- Offline: si no hay red, el kiosco encola marcajes localmente y sincroniza con la hora del dispositivo + flag de offline; nunca rechazar un marcaje por falta de internet.

## Módulos de la categoría (checklist competitiva; detalle en research/saas-dashboards.md §3)

Enrolamiento · kiosco · geolocalización · offline · turnos · tardanzas · horas extra · ausencias · reportes (exportación Excel/CSV; **T-Registro nativo: ningún competidor lo tiene** — oportunidad) · notificaciones (WhatsApp como canal clave en Perú) · multi-sucursal · roles (admin/supervisor/empleado) · auditoría/anti-fraude.

Marcar explícitamente lo que queda "próximamente" en UI en vez de ocultarlo (convención del dueño de UX/mesa).

## Competidores y diferenciación (argumentos ya decididos)

- ZKTeco + resellers locales: dominan con hardware S/ 1,100-3,500+. Nosotros: "el reloj eres tú", cero CAPEX.
- Jibble (freemium, USD/u/mes), GeoVictoria (por usuario, cotización): nosotros precio plano por sede.
- Anti-fraude visible como marketing: liveness + foto + latencia mostradas en la demo — los resellers no muestran el "cómo".
- Competidor real del presupuesto: el huellero de S/ 110 de Mercado Libre → el pitch es cumplimiento + auditoría, no "asistencia digital" genérica.

## Voz del producto

Español peruano: marcaje (no clock-in/check-in), tardanza, refrigerio, enrolamiento, planilla, chamba solo en marketing, nunca en UI.

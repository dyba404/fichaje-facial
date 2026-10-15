# ADR-0006: Autenticación y sesiones — cookie httpOnly + argon2id; kiosco por device API key

- Estado: Aceptada (2026-09-28, /plan del change 0001)
- Decide: aprobado por el dueño del producto

## Contexto

Dos planos de identidad: (1) usuarios del dashboard — admin y supervisor (roles de PRODUCT.md) — con acceso a evidencia biométrica; (2) kioscos como dispositivos que envían frames y marcajes sin usuario delante. Datos en juego: biometría y registros laborales (constitution §5).

## Decisión

- **Dashboard:** sesión por **cookie httpOnly + SameSite=Lax** (`@fastify/secure-session`, secreto en `.env`). Passwords con **argon2id**. Roles: `admin` (todo) y `supervisor` (su sede: aprueba, ve evidencia).
- **Kiosco:** **device API key** por dispositivo registrado (hash en `device.api_key_hash`), header `Authorization: Device <key>`; last_seen_at para inventario.
- **PIN de empleado:** argon2id en `employee.pin_hash`; marcajes PIN llevan foto de evidencia (REQ-MAR).

## Alternativas consideradas

- **JWT:** revocación/logout server-side más incómodo; no hay federación ni multi-servicio que lo justifique.
- **OAuth/SSO:** overkill para LAN de PYME en MVP.

## Consecuencias

+ Revocación inmediata de **device API keys** (borrar la fila en BD).
+ La foto de evidencia solo se sirve por endpoint autenticado con rol — nunca estática.
− Mismo origen o proxy en dev (Vite proxy a :3000) para que la cookie funcione; documentado en setup.
− **Hallazgo verificado en tests (2026-09-28):** la cookie de sesión es *stateless* — `logout` vacía la cookie del cliente, pero una cookie vieja ya emitida sigue siendo válida hasta expirar. Suficiente para MVP en LAN; la revocación server-side de sesiones (tabla de sesiones) queda en el endurecimiento de producción (task 3.5 del change 0001).

---
name: landing-factory
description: Pipeline para construir landings de negocio local (chifas, cevicherías, restaurantes, gyms, dentistas) que salgan completas a la primera — especificación obligatoria de capa de motion (intro, Lenis, reveals enmascarados, parallax interno, fotos reales), kit de código probado y protocolo de verificación en navegador que no compite con las animaciones. Use al construir cualquier landing nueva o antes de mostrarle una v1 al usuario.
version: 1.0.0
---

# Landing Factory

Esta skill existe porque se perdió una iteración completa construyendo una landing "de póster" con ilustraciones SVG y sin motion: el usuario la rechazó como "muy cruda". Su estándar —confirmado con la referencia Don Molinico (Awwwards SOTD)— es que la v1 ya traiga la capa completa. El diseño lo pone la skill `taste` (tokens) o `hallmark` (anti-slop); esta skill garantiza que el ACABADO venga incluido desde el primer build.

## Regla de oro

Nunca entregar una landing v1 sin los 8 puntos del checklist. Si falta tiempo, recortar contenido de secciones, nunca la capa de motion ni las fotos reales.

## Checklist obligatorio v1

1. **Intro de presentación** (2.5-3s): pantalla de marca + barra de progreso + panel que se levanta con `cubic-bezier(.19,1,.22,1)`; el titular del hero sube línea por línea SINCRONIZADO con el lift. `history.scrollRestoration = "manual"` para que siempre juegue desde arriba.
2. **Scroll con inercia (Lenis)**: `<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js">` + init con `lerp: 0.09` + rAF loop. Fallback silencioso si el CDN falla. Anclas por `lenis.scrollTo()`.
3. **Reveals enmascarados**: titulares partidos en `.mask > span` (translateY 115% → 0, 1.1s expo) disparados por IntersectionObserver; cascadas escalonadas con `--d` en cards.
4. **Parallax interno de fotos**: cada foto vive en un contenedor `overflow:hidden` y se mueve ±20-30px dentro de sí misma según su posición en el viewport (rAF loop). Esto es lo que hace que las fotos "respiren".
5. **Hero vivo**: Ken Burns continuo (scale 1.03→1.15 alternado) + parallax de fondo + logo/badge flotante que aparece al pasar el hero (reducido ~72% para no tapar contenido).
6. **Un gesto de firma**: abanico de fotos que se despliega, marquee, cintas con muescas, logo-watermark. Elegir 1-2, no todos.
7. **Fotos REALES** — jamás placeholders ni ilustraciones SVG si la referencia usa fotografía. Método en `references/fotos-reales.md`.
8. **Accesibilidad incluida** (las referencias NO la traen y es diferenciador): `:focus-visible`, `prefers-reduced-motion` (intro saltada, todo estático), contraste AA en textos pequeños (dorado sobre crema NO pasa: usar ocre #8F6408), semántica + aria.
9. **Entrega standalone**: antes de enviar/compartir el HTML, generar la versión autocontenida — sin fotos/fuentes/Lenis en CDNs, el HTML abierto sin internet se ve roto (fotos vacías, tipografías genéricas, sin motion). Generador probado: `references/empaquetar.mjs` — `node empaquetar.mjs entrada.html salida.html` incrusta fotos, Google Fonts (woff2 en base64) y scripts como data URIs; verificar con `performance.getEntriesByType('resource')` = 0 externas y tamaño esperado (~1.5-2.5 MB).

## Kit de código probado

`references/motion-kit.html` — página autocontenida con los puntos 1-5, 8 integrados y marcados con `<!-- PERSONALIZAR -->`. Deriva del build verificado de Chifa Doña Lim. Copiarlo como esqueleto y cambiar tokens/contento; no reescribir el motor de animaciones desde cero.

## Verificación sin iterar de más

`references/verificacion-navegador.md` — protocolo para verificar en el navegador embebido SIN que las capturas compitan con las animaciones. Leerlo ANTES de la primera verificación, no después del primer timeout.

## Orden de trabajo recomendado

1. Fotos primero (búsquedas + hoja de contactos + verificación) — es lo más lento.
2. Build completo con el kit.
3. Verificación por secciones con el protocolo.
4. Recién entonces mostrar al usuario.

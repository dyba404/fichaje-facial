# Verificación en navegador sin iterar de más

Lecciones de la sesión Chifa Doña Lim (2026-09-27). Todos los problemas ocurrieron de verdad y costaron tiempo.

## 1. Screenshots que compiten con las animaciones

**Síntoma:** una sección se ve vacía o a medio revelar en el screenshot; al depurar con `getComputedStyle` todo está en `opacity: 1`.

**Causa:** las capturas corren DURANTE el lerp de Lenis y las transiciones de reveal (1.1s + stagger). Un frame tomado a 1.8s no representa el estado final.

**Regla:** tras cualquier salto programático, esperar **3 segundos** antes de capturar. Y si algo "no aparece", verificar estado computado ANTES de tocar el código:

```js
// expresión (no statement) — este facade evalúa expresiones
(function(){ var el = document.querySelector('.cosa');
  return JSON.stringify({cls: el.className, op: getComputedStyle(el).opacity,
    rect: el.getBoundingClientRect().toJSON(), imgCargada: el.querySelector('img')?.complete}); })()
```

Si `opacity: 1` y `complete: true` → era timing, no bug. No "arreglar".

## 2. window.scrollTo no mueve páginas con scroll-jacking (Lenis/GSAP/locomotive)

**Síntoma:** dos screenshots consecutivos idénticos aunque el scrollTo "funcionó".

**Regla:** en sitios de referencia con scroll suave, scrollear con **eventos de rueda reales**:
`tab.cua.scroll({ x: 720, y: 450, scrollX: 0, scrollY: 2000 })` en ráfagas de 3-4 con 700-900ms entre cada una. Teclado (PageDown/End/Inicio) sirve de plan B. Repetir `window.scrollTo` NUNCA funciona en estas páginas.

En TU propia página con Lenis: `window.scrollTo({behavior:'instant'})` sí funciona, pero Lenis sigue lerp-eando — ver regla 1.

## 3. cua.scroll y screenshots a veces dan timeout (30s)

**Síntoma:** `browser command screenshot/cuaScroll timed out`.

**Realidad:** el scroll SÍ aplicó o el render solo estaba ocupado. No reintentar de inmediato: esperar 2s, capturar estado barato (screenshot nuevo) y seguir. Un timeout NO significa que el tab murió.

**Regla:** máximo 1 reintento con espera intermedia. Si un `fullPage: true` da timeout, NO insistir: capturar por tramos con rueda.

## 4. Chrome restaura el scroll al recargar

**Síntoma:** tras `reload()`, la página aparece a mitad del documento (donde estaba antes) y las secciones "no cargan".

**Causa:** restauración de scroll de Chrome + `history.scrollRestoration` por defecto.

**Regla:** en landings con intro, fijar `history.scrollRestoration = "manual"` en el propio sitio (ya viene en motion-kit). Al verificar, tras reload: `window.scrollTo(0,0)` + 3s de espera.

## 5. Evaluar en la página: expresiones, no statements

Este facade de evaluate rechaza `var x = ...` como statement. Usar IIFE-expresión que retorna JSON.stringify. Para congelar una animación CSS en un frame (ej. ver la intro a mitad):

```js
(function(){ var i = document.getElementById('intro');
  if (i) { i.style.cssText = 'animation-delay:-.55s !important; animation-play-state:paused !important;'; return 'ok'; }
  return 'ya fue removida por JS'; })()
```

Ojo: si la intro se auto-remueve con setTimeout(3000), hay que congelarla antes de 3s tras el reload.

## 6. Servir local sin Python

Esta máquina no tiene Python. Servidor estático de 15 líneas con `node:http` (ver `chifa/serve.js`), correr con Bash `run_in_background`, confirmar con `curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/` → 200.

## 7. Orden de verificación (barato → caro)

1. `curl -I` de las URLs de fotos (200 antes de abrir el navegador).
2. Un solo pass por secciones: hero → cada sección → footer, con 3s de espera y 1 screenshot cada una.
3. Debug computado solo de lo que se vea mal (regla 1).

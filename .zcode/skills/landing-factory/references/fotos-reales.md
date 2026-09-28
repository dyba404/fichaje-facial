# Fotos reales — método que funciona (y lo que no)

La primera búsqueda con curl a Pexels/Unsplash fue bloqueada y costó tiempo. Este es el método probado, en orden:

## 1. Buscar en el navegador embebido (no con curl)

Abrir pestañas de `https://www.pexels.com/search/{término}/` (una pestaña, navegando entre términos). El evento `load` puede tardar >10s y el goto dará timeout — es normal: esperar 3.5s y extraer igual.

Extraer URLs de las imágenes renderizadas:

```js
// expresión IIFE para este facade
(function(){ return JSON.stringify(Array.from(document.querySelectorAll('img'))
  .map(function(i){return i.src;})
  .filter(function(s){return s.includes('images.pexels.com/photos/');})
  .slice(0,12)); })()
```

**Términos que funcionaron para nicho peruano:** `arroz chaufa`, `chifa`, `chicha morada`, `pollo frito`, `fried wonton`, `shumai dumplings`, `wok cooking fire`. Los términos genéricos ingleses (`cola glass`, `omelette`) devuelven fotos de marca o irrelevantes.

**Ojo:** URLs con slug (`/photos/28490841/free-photo-of-...jpeg`) fallan al reconstruirlas — quedarse con IDs planos (`/photos/{id}/pexels-photo-{id}.jpeg`) o copiar la URL completa tal cual.

## 2. Hoja de contactos local — elegir VIENDO, nunca a ciegas

Generar una página local con las candidatas a 420px + etiqueta, servirla con el mini servidor node y capturarla con 1-2 screenshots. Grid de 4 columnas, `object-fit: cover` a 230px. En una sola pasada se descartan las malas (banderas de marca, fotos irrelevantes).

## 3. Verificar con curl antes de meterlas al HTML

```bash
for id in 8960427 17952748; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://images.pexels.com/photos/$id/pexels-photo-$id.jpeg?auto=compress&cs=tinysrgb&w=800")
  echo "$id -> $code"
done
```

Solo usar IDs que devuelvan 200.

## 4. Parámetros de hotlink probados

- Hero: `?auto=compress&cs=tinysrgb&w=1600`
- Cards/fan: `?auto=compress&cs=tinysrgb&w=700-800`
- Añadir `preconnect` a `https://images.pexels.com`, `loading="lazy"` (excepto hero: `fetchpriority="high"`), `width/height` y `alt` descriptivo en español del nicho.

## IDs verificados para nicho chifa (por si se reutilizan)

hero wok fuego 8960427 · chaufa 17952748 · arroz camarones 34683317 · pollo glaseado 36989868 · wantanes 37153389 · siu mai 5409009 · chicha morada 9136977 · tallarines con palillos 34692771 · faroles 19121466 · chaufa blanco 9738983 · chaufa oscuro 4224304

## Evitar

- Fotos con marcas visibles (Coca-Cola etc.) — buscan "gaseosa" y salen todas de marca; mejor cambiar el ítem del menú (chicha morada en vez de gaseosa).
- Imágenes con acción ajena al plato (bailarines, banderas) salvo que aporten ambiente de barrio chino (faroles sí).
- Elegir sin previsualizar: el `figcaption` "ERROR" de la hoja de contactos detecta URLs rotas con slug.

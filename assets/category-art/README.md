# `assets/category-art/`

Renders 3D fotorrealistas de categoría — sustituyen la ilustración SVG que
mostraba `js/ui/productArt.js` (retirado) cuando un producto no tiene fotos
reales. Los sirve `js/ui/categoryArt.js`; ver ADR-010 en
`docs/DECISIONES.md` para el porqué completo.

**Esta carpeta está vacía a propósito.** Ningún render definitivo existe
todavía — la infraestructura (componente, CSS, service worker) ya está
lista para recibirlos, pero no se generaron imágenes de prueba ni
placeholders. Mientras un archivo no exista, `categoryArt.js` cae
automáticamente al ícono de línea de esa categoría.

## Archivos que espera cada categoría

Dos tamaños por categoría, exactamente estos 16 nombres (mismos `id` que
`js/data/categories.js`):

```
motor-256.webp        motor-512.webp
frenos-256.webp       frenos-512.webp
suspension-256.webp   suspension-512.webp
baterias-256.webp     baterias-512.webp
aceites-256.webp      aceites-512.webp
filtros-256.webp      filtros-512.webp
iluminacion-256.webp  iluminacion-512.webp
cauchos-256.webp      cauchos-512.webp
```

`256` se usa en la grilla de resultados y las filas de lista/carrito;
`512` en la ficha de detalle de producto — `categoryArt()` arma el
`srcset` con ambos y el navegador elige según el tamaño real en pantalla.

## Especificación de producción

Ambos tamaños se recortan de un render maestro de 3000×3000px — nunca se
agranda un archivo chico. Resumen (la Guía Visual Oficial de RedAuto v1
tiene el detalle completo: ángulo de cámara, iluminación de 3 puntos,
prompts maestros por categoría):

| | |
|---|---|
| Formato | WebP, calidad 85% |
| Fondo | Transparencia alfa real — nunca un relleno blanco/gris |
| Relación de aspecto | 1:1 exacto en ambos tamaños |
| Perfil de color | sRGB, sin perfil ICC incrustado |
| Peso objetivo | ≤15KB (256px) · ≤35KB (512px) |
| Rojo de marca | `#E53935` únicamente, como acento mínimo — nunca protagonista |

## Cómo agregar los renders definitivos

1. Soltar los 16 archivos WebP en esta carpeta con los nombres exactos de
   arriba. No hace falta tocar `categoryArt.js`, `components.js` ni el CSS
   — ya apuntan a estas rutas.
2. Subir `CACHE_VERSION` en `sw.js` (mismo mecanismo que cualquier otro
   asset nuevo) para que el service worker los precachee de verdad — hoy
   los intenta precachear pero falla en silencio porque no existen.
3. Verificar en el navegador que cada categoría muestra su render y no el
   ícono de línea de respaldo.

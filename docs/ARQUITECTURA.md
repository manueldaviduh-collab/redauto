# Arquitectura de RedAuto

Este documento explica **cómo está armado el código hoy**, **por qué se
armó así** y **qué se rompe primero** si el proyecto crece sin ajustar la
arquitectura. Complementa a [`PRINCIPIOS.md`](./PRINCIPIOS.md) (el qué y el
por qué de producto) y a [`BASE_DE_DATOS.md`](./BASE_DE_DATOS.md) (el
modelo de datos). Las decisiones puntuales con alternativas consideradas
viven en [`DECISIONES.md`](./DECISIONES.md).

## 1. Qué es esto hoy, en una frase

Una SPA estática (HTML/CSS/JS con módulos ES nativos, **sin build step, sin
framework, sin backend**) que corre 100% en el navegador y persiste todo en
`localStorage`. No es un prototipo desechable: está deliberadamente
organizada en capas para que reemplazar "sin backend" por "con backend" sea
un cambio **localizado y mecánico**, no una reescritura.

## 2. Las capas y la regla de dependencia

```
screens/   → una pantalla = una función render(container, params)
   ↓ (sólo puede llamar hacia abajo)
services/  → toda la lógica de negocio y el único punto de acceso a datos
   ↓
data/      → catálogos/semillas en memoria (el "contenido" del MVP)

ui/        → presentación reutilizable (icons, components, chat, modal,
              toast, productArt) — usada por screens/, y también consume
              algunos services/ directamente (ver §2.1)

router.js / nav.js → capa transversal: decide qué screen renderizar y
                      cómo se navega; no contiene lógica de negocio
```

**La regla que importa:** una pantalla (`screens/*.js`) nunca importa
`data/*.js` directamente (salvo catálogos de sólo lectura como categorías o
vehículos, que no tienen estado que mutar). Siempre pasa por un
`services/*.js`. Esto es lo que hace posible que, el día que exista un
backend, `productService.search()` cambie de "filtrar un array en memoria"
a "hacer un `fetch('/api/products/search?...')`" **sin tocar
`search.js`, `home.js` ni ningún otro screen** — porque ellos nunca supieron
que era un array en memoria, solo conocen el contrato `async search(filters)
→ Product[]`.

### 2.1. La excepción deliberada: `ui/components.js` sí toca `services/`

`bindProductCardEvents()` (en `js/ui/components.js`) importa
`cartService` y `favoritesService` directamente, porque el botón de
"agregar al carrito" y el de "favorito" están **dentro** del componente de
tarjeta de producto que se reutiliza en seis pantallas distintas. Poner esa
lógica en cada pantalla que renderiza una tarjeta habría significado
duplicar el mismo `addEventListener` seis veces. Es una excepción
consciente a la regla de capas, acotada a interacciones genuinamente
transversales (agregar al carrito, marcar favorito) — no una puerta abierta
para que cualquier componente de UI hable con cualquier servicio. Si en el
futuro esto empieza a sentirse como una regla que se rompe seguido en vez
de una excepción puntual, es señal de que la arquitectura necesita una capa
de "acciones" explícita entre `ui/` y `services/` (ver
[`DECISIONES.md`](./DECISIONES.md)).

## 3. Mapa de módulos

```
index.html          Shell: contenedores fijos (splash, #screen-content,
                     #bottom-nav-root, #toast-root, #modal-root)
assets/              logo-mark.png / favicon.png
css/styles.css       Sistema de diseño: tokens + componentes (un solo
                     archivo a propósito — ver DECISIONES.md)

js/
  app.js             Entry point: arranca el router, controla el splash
  router.js           Hash router: mapea rutas → screen, nav inferior activa,
                       transición de entrada, badge del carrito
  nav.js               navigate()/parseHash() — sin dependencias circulares
                       con router.js (por eso vive separado)

  data/                Catálogos y semillas (arrays estáticos en memoria)
    categories.js, vehicles.js, stores.js, products.js, users.js,
    notifications.js, reviews.js

  services/            Toda la lógica de negocio; contratos `async`
    storage.js          Envoltorio sobre localStorage (namespace "redauto_"
                         + try/catch — nunca se llama a localStorage directo
                         desde otro archivo)
    productService.js   Búsqueda/filtros, compatibilidad de vehículo, estado
                         de inventario (3 niveles), catálogo base + overrides
                         del vendedor
    storeService.js      Listado/detalle de tiendas verificadas
    categoryService.js
    vehicleService.js    Garage de "Mis Vehículos" (CRUD) + vehículo activo
    cartService.js        Carrito + evento global CART_CHANGED_EVENT
    favoritesService.js   Favoritos de productos y de tiendas (misma forma,
                          namespaces distintos) + FAVORITES_CHANGED_EVENT
    authService.js         Sesión demo + registro
    orderService.js         Historial de pedidos + checkout (sin pagos)
    sellerService.js         Agrega datos para el panel de vendedor
    notificationService.js   Centro de notificaciones (leído/no leído)

  ui/                   Presentación reutilizable, sin estado propio de
                         negocio (aparte de la excepción de §2.1)
    icons.js             Set de íconos SVG propio (sin librería externa)
    productArt.js         Ilustraciones vectoriales de producto por
                          categoría (ver DECISIONES.md)
    components.js          Tarjetas, badges, header, nav inferior,
                          bindProductCardEvents/bindStoreCardEvents
    chat.js                 Modal "Preguntar a la tienda"
    modal.js, toast.js        Bottom sheet genérico / notificaciones toast

  screens/              14 pantallas, todas con la firma
                        `render(container, { path, segments, query })`
    home.js, search.js, product.js, stores.js, storeDetail.js, cart.js,
    checkout.js, login.js, register.js, profile.js, seller.js,
    myVehicles.js, favorites.js, notifications.js
```

## 4. Cómo se renderiza una pantalla

No hay virtual DOM ni framework de componentes. Cada `render()`:

1. Escribe un estado de carga (`container.innerHTML = skeleton`) o deja el
   router mostrar la transición de entrada.
2. `await` a los `services/*` que necesite.
3. Reemplaza `container.innerHTML` con el HTML final (template strings).
4. Enlaza eventos con `container.querySelector(...).addEventListener(...)`.

Es deliberadamente simple: para 14 pantallas y sin necesidad de
actualizaciones parciales de alta frecuencia, un framework reactivo
(React/Vue/Svelte) habría sido complejidad sin beneficio medible todavía.
El costo de esta simplicidad — y cuándo deja de convenir — está en
[`DECISIONES.md`](./DECISIONES.md#adr-001-sin-framework-de-frontend).

## 5. Cómo se comunican los módulos entre sí (eventos globales)

Como no hay un store central de estado (Redux/Zustand/etc.), los cambios
que afectan a más de una pantalla se propagan con `CustomEvent` en
`window`. Patrón usado consistentemente en tres servicios:

```js
export const ALGO_CHANGED_EVENT = 'redauto:algo-changed';
// dentro del servicio, tras escribir en localStorage:
window.dispatchEvent(new CustomEvent(ALGO_CHANGED_EVENT));
```

- `cartService` → `CART_CHANGED_EVENT` (actualiza el badge del carrito en
  el header y la nav inferior, sin importar qué pantalla hizo el cambio).
- `vehicleService` → `GARAGE_CHANGED_EVENT`.
- `favoritesService` → `FAVORITES_CHANGED_EVENT`.

`router.js` escucha `CART_CHANGED_EVENT` globalmente porque el badge del
carrito vive en la navegación inferior, presente en todas las rutas. Este
patrón escala bien hasta un puñado de eventos transversales; si en algún
punto se necesitan muchos más (más de ~8–10 tipos de evento cruzando
pantallas), es la señal para introducir un store de estado real en vez de
seguir sumando `CustomEvent`s sueltos (ver
[`DECISIONES.md`](./DECISIONES.md)).

## 6. Qué se rompe primero si esto crece sin cambiar nada

Ordenado por qué tan pronto se vuelve un problema real:

| Límite actual | Por qué existe | Cuándo se vuelve bloqueante |
|---|---|---|
| `localStorage` es **por navegador**, no por cuenta | No hay backend | Inmediatamente en cuanto haya una tienda real: el vendedor edita su inventario en su navegador y **ningún comprador en otro dispositivo lo ve**. Este es el bloqueador #1 antes del piloto — ver `ROADMAP.md`, Etapa 0. |
| `productService.search()` filtra un array en memoria | No hay base de datos | Deja de ser instantáneo bien antes de "millones de productos" — con cientos de tiendas y miles de productos ya conviene un índice real (Postgres con índices, luego un motor de búsqueda si hace falta relevancia). No es un problema a los 50–200 productos de un piloto. |
| No hay control de concurrencia de inventario | No hay base de datos | En cuanto dos compradores puedan comprar la última unidad del mismo producto al mismo tiempo. Bloqueante para cualquier operación con inventario real ajustado (no antes). |
| El carrito y la sesión no sobreviven a "borrar datos del navegador" | Diseño intencional del MVP | Aceptable para demo/piloto controlado; no aceptable para un usuario real que cambia de teléfono o borra caché. |
| Sin SEO / sin server-side rendering | SPA pura, contenido no indexable por buscadores | Bloqueante el día que la adquisición de compradores dependa de tráfico orgánico de Google hacia páginas de producto/tienda. No bloqueante mientras la adquisición sea directa (referidos, redes sociales, boca a boca del piloto). |
| Un solo idioma, una sola moneda (USD, sin formateo por locale) | No hace falta todavía | Bloqueante sólo al expandir fuera de Venezuela o a un mercado con otra moneda dominante. |
| Sin panel de analítica/eventos | No implementado | No bloquea el piloto; sí bloquea decidir con datos qué mejorar después del piloto — conviene instrumentarlo apenas haya usuarios reales, no antes (ver `ROADMAP.md`). |

## 7. Cómo se conecta a un backend real (mecánica del cambio)

Cada `services/*.js` ya tiene la forma de un cliente de API: funciones
`async`, un solo objeto exportado, sin filtrarle detalles de
`localStorage` a quien lo llama. El cambio, cuando llegue el backend
(ver `ROADMAP.md`, Etapa 1), es reemplazar el **cuerpo** de cada función,
no su firma. Ejemplo real con `productService.search`:

```js
// Hoy (js/services/productService.js)
async search(filters = {}) {
  await delay();
  return getAllMerged().filter((p) => { /* ...filtros en memoria... */ });
}

// Con backend — misma firma, mismos llamadores (search.js no cambia):
async search(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`/api/products/search?${params}`);
  if (!res.ok) throw new Error('No se pudo buscar productos');
  return res.json();
}
```

Esto aplica igual a `authService.login`, `orderService.checkout`,
`sellerService.getDashboard`, etc. La migración se puede hacer **servicio
por servicio**, no todo de una vez — por ejemplo, mover primero
`productService` y `storeService` a un backend real (catálogo compartido,
el bloqueador #1 de la tabla anterior) mientras `favoritesService` y
`vehicleService` se quedan en `localStorage` un tiempo más, porque no
bloquean nada todavía.

## 8. Cuándo NO escalar todavía (guardrails)

Tan importante como saber qué se rompe primero es no construir para
problemas que no existen. Con el tamaño de piloto descrito en
`ROADMAP.md` (unas pocas tiendas reales), **no hace falta todavía**:

- Microservicios o separar el backend en varios repos/servicios.
- Un motor de búsqueda dedicado (Elasticsearch/Meilisearch) — Postgres con
  índices y `ILIKE`/full-text search alcanza hasta miles de productos.
- Cola de mensajes / arquitectura orientada a eventos entre servicios.
- Sharding o read-replicas de base de datos.
- CDN de imágenes con transformación on-the-fly — un bucket de storage con
  un tamaño fijo razonable alcanza mientras el catálogo sea chico.
- Internacionalización (i18n) más allá de tener los textos en español en
  un solo lugar fácil de extraer después.

Construir cualquiera de estos ahora sería tiempo de desarrollo que no se le
dedica a validar si el modelo de negocio (comisión por transacción, tiendas
reales usando el panel de vendedor, compradores reales completando
checkout) funciona — que es la pregunta que el piloto con las tiendas del
papá del fundador está diseñado para responder primero.

## 9. Verificación y calidad

No hay suite de tests automatizados todavía (ni unitarios ni end-to-end
persistidos en el repo). La verificación actual es manual: se levanta un
servidor estático y se recorren los flujos con Chromium vía Playwright
durante el desarrollo. Esto es razonable para el tamaño y la velocidad de
cambio actuales del proyecto, pero es deuda técnica real: en cuanto exista
un backend y más de una persona tocando el código a la vez, la ausencia de
tests automatizados (sobre todo del flujo de checkout y del panel de
vendedor) se vuelve el primer lugar donde algo se rompe sin que nadie se
dé cuenta. Recomendación concreta para la Etapa 1 del roadmap: al menos
tests end-to-end de humo (Playwright) para login → buscar → agregar al
carrito → checkout, y para alta de producto en el panel de vendedor.

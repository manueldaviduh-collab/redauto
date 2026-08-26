# Arquitectura de RedAuto

Este es el documento de referencia para entender **cómo está armado
RedAuto, con qué tecnologías, por qué se tomó cada decisión, y qué falta
para llevarlo a producción con usuarios reales**. Está pensado para que un
desarrollador nuevo lo lea de punta a punta y quede orientado — y para
mostrárselo a quien evalúe el proyecto técnicamente.

Se mantiene actualizado a medida que el proyecto avanza: cualquier cambio
de arquitectura relevante (una tecnología nueva, una capa que se
reorganiza, un servicio que se conecta a un backend real) se refleja aquí
en el mismo cambio que lo introduce, no después.

Documentos relacionados, para no duplicar contenido:
- [`PRINCIPIOS.md`](./PRINCIPIOS.md) — el qué y el por qué de producto.
- [`BASE_DE_DATOS.md`](./BASE_DE_DATOS.md) — el modelo de datos completo
  (hoy y el esquema objetivo), referenciado desde §7 de este documento.
- [`DECISIONES.md`](./DECISIONES.md) — registro tipo ADR de cada decisión
  no obvia, con alternativas consideradas.
- [`ROADMAP.md`](./ROADMAP.md) — el plan de crecimiento por etapas.

---

## 1. Qué es esto hoy, en una frase

Una SPA (HTML/CSS/JS con módulos ES nativos, **sin build step, sin
framework**) que corre en el navegador, más un **backend real mínimo**
(`server/`: Node.js + Express + PostgreSQL) que ya sostiene el registro de
cuentas, el alta de tiendas y el CRUD de productos — no es un plan a
futuro, es código que corre y tiene una base de datos detrás. El resto
(carrito, pedidos, favoritos, garage de vehículos, notificaciones) sigue
viviendo en `localStorage` (ver §7 para el detalle exacto de qué está de
cada lado hoy). La app está organizada en capas justamente para que esa
migración fuera, servicio por servicio, un cambio **localizado y
mecánico** en vez de una reescritura — y eso ya se verificó en la
práctica: `authService`, `productService`, `storeService` y
`sellerService` se conectaron al backend real sin tocar el render de
ninguna pantalla, más allá de un checkbox nuevo en el formulario de
registro (ver §12).

## 2. Stack tecnológico

**Frontend (lo que existe hoy):**

| Pieza | Tecnología | Por qué |
|---|---|---|
| Marcado | HTML5 semántico, una sola `index.html` | Sin SSR ni generador de sitios — no hace falta con 14 pantallas (ver §11, límite de SEO) |
| Estilos | CSS3 plano, un solo `css/styles.css`, custom properties para tokens | Sin preprocesador (Sass/Less) ni Tailwind — ver `DECISIONES.md`. Un solo archivo es intencional mientras el proyecto tiene un tamaño donde partirlo en módulos añadiría indirección sin beneficio real |
| Lógica | JavaScript ES2020+, módulos ES nativos del navegador (`import`/`export`) | Sin TypeScript ni bundler todavía — ver `DECISIONES.md`, ADR-001. El código ya está organizado en capas con contratos claros, que es la parte de "disciplina de tipos" que más importa a este tamaño |
| Tipografía | Google Fonts (Poppins) | Única dependencia de red externa de la app; con fallback a fuentes del sistema si no hay conexión |
| Iconografía | SVG propio (`js/ui/icons.js`) | Cero librerías de íconos externas |
| Imágenes de producto | SVG generado en cliente (`js/ui/productArt.js`) | No hay fotografía real disponible — ver §9 y `DECISIONES.md`, ADR-005 |

**Herramientas de desarrollo (no forman parte del producto en sí):**

| Herramienta | Uso |
|---|---|
| Playwright + Chromium | Verificación manual de flujos durante el desarrollo (no hay suite persistida en el repo todavía — ver §15) |
| esbuild | Sólo se usa puntualmente para empaquetar una copia de un solo archivo de la app como demo interactivo compartible (artifact) — no es parte del pipeline de build del proyecto real, que no tiene build step |

**Backend (existe desde ahora — Etapa 1 del roadmap arrancada, en
[`server/`](../server/); ver `server/README.md` para cómo correrlo):**

| Pieza | Elegido | Por qué / alternativa considerada |
|---|---|---|
| Base de datos | PostgreSQL | NoSQL (Firestore/Mongo) — descartado, el dominio es relacional (ver `DECISIONES.md`, ADR-007) |
| Servidor API | Node.js + Express | Mismo lenguaje que el frontend (JS), sin capa nueva que aprender; suficiente para el número de endpoints actual (auth + products + stores) |
| Autenticación | JWT propio (`jsonwebtoken`) + contraseñas con `bcryptjs` | Se evaluó Supabase Auth (evita reconstruir esta pieza) pero se optó por control total del esquema de datos desde el día uno del piloto — ver `DECISIONES.md`, ADR-007. Sigue siendo una migración razonable más adelante si el volumen de auth lo justifica |
| Cliente de base de datos | `pg` (node-postgres), sin ORM | El esquema actual (4 tablas) no justifica todavía la indirección de un ORM (Prisma/Drizzle) — SQL directo en `server/src/routes/*.js` es más fácil de auditar a este tamaño |
| Hosting backend (para desplegar, ver `server/README.md`) | Railway o Render (Node + Postgres administrado en el mismo lugar), o Postgres en Supabase/Neon + servidor en cualquier otro proveedor | — |
| Hosting frontend | Cualquier hosting estático (Netlify, Vercel, GitHub Pages, S3+CDN) — el frontend sigue siendo estático incluso con backend real | — |

Lo que el backend **todavía no cubre** (carrito, pedidos/pagos, subida de
imágenes, reseñas, verificación real de tienda) sigue resuelto del lado
del cliente o simulado — ver §7, §9 y `ROADMAP.md` para el orden en que se
agrega cada pieza.

## 3. Las capas y la regla de dependencia

```
screens/   → una pantalla = una función render(container, params)
   ↓ (sólo puede llamar hacia abajo)
services/  → toda la lógica de negocio y el único punto de acceso a datos
   ↓
data/      → catálogos/semillas en memoria (el "contenido" del MVP)

ui/        → presentación reutilizable (icons, components, chat, modal,
              toast, productArt) — usada por screens/, y también consume
              algunos services/ directamente (ver §3.1)

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

### 3.1. La excepción deliberada: `ui/components.js` sí toca `services/`

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

## 4. Estructura del proyecto (mapa de módulos)

```
index.html          Shell: contenedores fijos (splash, #screen-content,
                     #bottom-nav-root, #toast-root, #modal-root)
assets/              logo-mark.png / favicon.png
css/styles.css       Sistema de diseño: tokens + componentes (un solo
                     archivo a propósito — ver DECISIONES.md)
docs/                Esta documentación

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
    authService.js         Sesión demo + registro (ver §8, Autenticación)
    orderService.js         Historial de pedidos + checkout (sin pagos)
    sellerService.js         Agrega datos para el panel de vendedor
    notificationService.js   Centro de notificaciones (leído/no leído)

  ui/                   Presentación reutilizable, sin estado propio de
                         negocio (aparte de la excepción de §3.1)
    icons.js             Set de íconos SVG propio (sin librería externa)
    productArt.js         Ilustraciones vectoriales de producto por
                          categoría (ver §9, Almacenamiento de imágenes)
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

## 5. Cómo se renderiza una pantalla

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

## 6. Comunicación entre módulos del frontend (eventos globales)

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

*(Esto es comunicación **dentro** del frontend. Para cómo se comunicará el
frontend con un backend real, ver §10.)*

## 7. Base de datos

**Ya existe una base de datos real** (PostgreSQL, esquema en
[`server/src/schema.sql`](../server/src/schema.sql)) para `users`,
`categories`, `stores` y `products` — el subconjunto necesario para que
una tienda real se registre y publique productos. Es deliberadamente más
chica que el esquema objetivo completo (sin `product_images`,
`order_items`, `reviews`, `vehicle_brands`/`vehicle_models`, etc.) porque
la tarea que la creó tenía alcance acotado a "registro + alta de
productos", no a migrar todo de una vez.

Lo que **todavía no tiene tabla real** — carrito, pedidos, favoritos,
garage de vehículos, notificaciones, reseñas — sigue como arrays en
`js/data/*.js` + `localStorage`, igual que antes.

Inventario completo de claves de `localStorage` que quedan, el esquema
implementado hoy, el esquema objetivo completo en Postgres, y el plan de
migración de lo que falta: **[`BASE_DE_DATOS.md`](./BASE_DE_DATOS.md)**.
Resumen de una línea: el esquema objetivo ya modelaba `store_id`/
`product_id`/etc. como si fueran claves foráneas reales desde antes de que
existiera backend, así que implementar la primera porción no exigió
rediseñar datos — exigió encender Postgres detrás de un esquema que ya
estaba pensado para eso, y el resto de las tablas objetivo esperan el
mismo tratamiento cuando les toque (ver `ROADMAP.md`).

## 8. Autenticación

**Real, contra el backend (`server/src/routes/auth.js` +
`server/src/middleware/auth.js`):** `js/services/authService.js` ya no
valida nada localmente — `register()`/`login()` llaman a
`POST /api/auth/register` / `POST /api/auth/login`. El servidor:
- Hashea la contraseña con `bcryptjs` (nunca la guarda ni la compara en
  texto plano).
- Devuelve un **JWT** (`jsonwebtoken`, 30 días de expiración) firmado con
  `JWT_SECRET`. El frontend guarda sólo ese token
  (`localStorage: auth_token`, ver `storage.js`), no la sesión "cruda", y
  lo envía como `Authorization: Bearer <token>` en cada request
  autenticado (ver §10).
- Valida email único (case-insensitive, índice único en `users`) y
  rechaza duplicados con un 409 legible.
- Registro de vendedor: si el formulario manda `storeName`, el registro
  de usuario y la creación de la tienda ocurren en **una sola transacción
  SQL** — o se crean ambos, o ninguno.

Los roles siguen siendo `comprador` y `vendedor` (el panel de vendedor,
`seller.js`, sólo es accesible con rol `vendedor`), pero ahora la
autorización se hace cumplir **en el servidor**, no sólo en el cliente:
`requireAuth`/`requireSeller` (middleware) protegen cada endpoint de
escritura de productos, y `storeId` para esas escrituras **siempre se
resuelve desde `owner_user_id` del token**, nunca desde lo que mande el
body del request — así un vendedor no puede escribir en el inventario de
otra tienda aunque intente mandar un `storeId` ajeno a mano (ver
`server/src/routes/products.js`, `getOwnStoreId`).

**Lo que falta antes de un volumen/sensibilidad mayores** (ver
`server/README.md`, sección de seguridad, y `ROADMAP.md`): límite de
intentos de login (rate limiting), verificación real de tienda — hoy toda
tienda que se registra queda `verificación: verificada` automáticamente,
una simplificación deliberada del piloto (self-service sin fricción para
el fundador), no un descuido de seguridad. Row Level Security (RLS) de
Postgres sigue siendo una capa adicional razonable si en algún momento se
migra a Supabase o se agregan más roles/endpoints donde sea fácil
olvidarse de un `if` de autorización en el código de la API.

## 9. Almacenamiento de imágenes

**Hoy:** no hay fotografía real de producto — no hay banco de imágenes
con licencia ni generador de imágenes disponible en este proyecto. En su
lugar, `js/ui/productArt.js` genera una ilustración SVG por categoría,
inline, en el propio navegador. Cero almacenamiento necesario: no hay
archivos de imagen que subir, guardar ni servir (el logo y el favicon en
`assets/` son la única excepción, y son estáticos). El razonamiento
completo y las alternativas consideradas están en
[`DECISIONES.md`, ADR-005](./DECISIONES.md).

**Objetivo (cuando las tiendas suban fotos reales desde el panel de
vendedor — ver `ROADMAP.md`, Etapa 1 en adelante):**
- Object storage administrado (**Supabase Storage** si se usa Supabase
  para el resto del backend, o S3/Cloudinary si no) — no servir imágenes
  desde el propio servidor de la aplicación.
- Tabla `product_images` ya diseñada en `BASE_DE_DATOS.md` (una fila por
  imagen, con `position` para el orden de la galería) — el panel de
  vendedor sube 1–5 fotos por producto, no una foto obligatoria única.
- Límite de tamaño razonable por imagen (ej. 5 MB) validado en el cliente
  antes de subir, y conversión a un formato liviano (WebP) — puede hacerlo
  el propio servicio de storage (Supabase/Cloudinary transforman al
  vuelo) en vez de escribir un pipeline de procesamiento de imágenes
  propio.
- Un CDN con transformación de imágenes on-demand (miniaturas, distintos
  tamaños por breakpoint) **no hace falta desde el día uno** — ver §14,
  se agrega cuando el catálogo de fotos reales sea grande, no antes.
- Las ilustraciones vectoriales de `productArt.js` no desaparecen: quedan
  como *fallback* para productos sin foto todavía, en vez de ser el
  tratamiento por defecto.

## 10. Comunicación frontend ↔ backend

**Ya existe, para auth/productos/tiendas** — `js/services/api.js` es el
cliente HTTP (`fetch` con manejo de errores y del header `Authorization`
centralizados) que usan `authService`, `productService`, `storeService` y
`sellerService` para hablar con `server/`. El resto de los servicios
(`cartService`, `orderService`, `favoritesService`, `vehicleService`,
`notificationService`) todavía resuelve contra `localStorage` — mismo
contrato `async`, sin backend real detrás todavía (ver §7).

**Convención implementada:**

| Aspecto | Cómo está hoy |
|---|---|
| Protocolo | HTTP (HTTPS en producción), REST (`GET/POST/PATCH`) |
| Formato | JSON en request y response |
| Rutas | `/api/auth/{register,login,me}`, `/api/products[/:id][/mine/list]`, `/api/stores[/:id]` — ver la tabla completa en `server/README.md` |
| Autenticación | Header `Authorization: Bearer <jwt>` en cada request autenticado (ver §8), agregado automáticamente por `api.js` cuando se llama con `{ auth: true }` |
| Errores | Códigos de estado HTTP (400/401/403/404/409/500) + body `{ "error": "mensaje legible" }`. `js/services/api.js` los convierte en una `ApiError` con ese mensaje, que cada pantalla muestra tal cual (ver `seller.js`, que ya no traga errores de conexión en silencio) |
| CORS | El servidor usa `cors({ origin: CORS_ORIGIN })` — en desarrollo `*`, en producción hay que fijarlo al dominio real del frontend (ver `server/README.md`, sección de despliegue) |
| Configuración de URL | `window.REDAUTO_API_URL` en `index.html` — un solo valor a cambiar al desplegar, no hace falta tocar ni reconstruir el resto de la app |
| Paginación | No existe todavía (catálogos chicos). Al crecer, `GET /api/products?page=2&pageSize=20` — no es un problema real a la escala del piloto |

**Cómo se mantiene la app usable sin backend desplegado en algún lado:**
la navegación de compra (`productService`/`storeService`) intenta el
backend y, si no responde, degrada en silencio al catálogo local de
`js/data/*.js` — para que Home/Buscar/Tiendas nunca se rompan del todo. El
panel de vendedor (`sellerService`) hace lo opuesto a propósito: **no**
esconde un fallo de conexión, porque un vendedor necesita saber si su
inventario está vacío o si el servidor simplemente no respondió (ver
`docs/PRINCIPIOS.md`, Transparencia).

## 11. Qué se rompe primero si esto crece sin cambiar nada

Ordenado por qué tan pronto se vuelve un problema real:

| Límite actual | Por qué existe | Cuándo se vuelve bloqueante |
|---|---|---|
| `localStorage` es **por navegador**, no por cuenta — **ya resuelto para tiendas/productos/cuentas** (viven en Postgres), **sigue así para carrito/pedidos/favoritos/garage** | Backend implementado sólo para auth+productos+tiendas (ver §7) | Ya no bloquea la parte de catálogo: un vendedor que edita su inventario, cualquier comprador en cualquier dispositivo lo ve. Sigue bloqueando pedidos reales entre dispositivos — el carrito y el historial de compra todavía son por navegador (ver `ROADMAP.md`, resto de la Etapa 1). |
| `productService.search()` sobre backend filtra con `ILIKE`, no un índice de texto completo | Base de datos ya existe, pero sin índice de búsqueda dedicado todavía | Deja de ser instantáneo bien antes de "millones de productos" — con cientos de tiendas y miles de productos conviene un índice full-text o un motor de búsqueda dedicado. No es un problema a los 50–200 productos de un piloto. |
| No hay control de concurrencia de inventario (dos compradores comprando la última unidad a la vez) | El backend actual no tiene todavía un flujo de compra/reserva de stock (sólo CRUD de productos) | Bloqueante en cuanto exista checkout real contra este backend con inventario ajustado — no antes, porque hoy no hay checkout real que descuente stock. |
| El carrito, el historial de pedidos y el garage de vehículos no sobreviven a "borrar datos del navegador" | Todavía no migrados a Postgres (ver §7 y `BASE_DE_DATOS.md` §6) | Aceptable para el piloto controlado actual; no aceptable para un comprador real que cambia de teléfono o borra caché — es el siguiente paso de la Etapa 1, no de una etapa futura. |
| Sin SEO / sin server-side rendering | SPA pura, contenido no indexable por buscadores | Bloqueante el día que la adquisición de compradores dependa de tráfico orgánico de Google hacia páginas de producto/tienda. No bloqueante mientras la adquisición sea directa (referidos, redes sociales, boca a boca del piloto). |
| Un solo idioma, una sola moneda (USD, sin formateo por locale) | No hace falta todavía | Bloqueante sólo al expandir fuera de Venezuela o a un mercado con otra moneda dominante. |
| Sin panel de analítica/eventos | No implementado | No bloquea el piloto; sí bloquea decidir con datos qué mejorar después del piloto — conviene instrumentarlo apenas haya usuarios reales, no antes (ver `ROADMAP.md`). |

## 12. Cómo se conecta a un backend real (mecánica del cambio, ya ejecutada una vez)

Cada `services/*.js` tiene la forma de un cliente de API: funciones
`async`, un solo objeto exportado, sin filtrarle a quien lo llama si hoy
resuelve contra `localStorage` o contra una red real. El cambio, para
cada servicio migrado, fue reemplazar el **cuerpo** de sus funciones, no
su firma — y las pantallas que los llaman no se tocaron. Ejemplo real,
`productService.search`, tal como quedó (`js/services/productService.js`):

```js
async search(filters = {}) {
  await delay();
  const base = applyFilters(getAllMerged(), filters);       // catálogo local (js/data/products.js)
  const remote = await fetchBackendProducts(filters);        // fetch a /api/products — [] si falla
  return [...base, ...remote];                               // namespaces de id disjuntos (p1.. vs uuid)
}
```

`search.js`/`home.js` no cambiaron una línea: siguen llamando
`productService.search(filters)` y recibiendo un array de productos, sin
saber que ahora una parte viene de Postgres. `authService`,
`storeService` y `sellerService` se migraron con el mismo patrón —
`authService` fue el único que dejó de tener un "modo local" en paralelo,
porque no tiene sentido simular login/registro cuando ya hay backend real
para eso.

**Por qué el catálogo se sirve *mezclado* (local + backend) en vez de
sólo backend:** para que Home/Buscar/Tiendas nunca se vean vacíos por un
fallo de red — ver §10 y `docs/PRINCIPIOS.md`. Las tiendas/productos de
`js/data/*.js` siguen existiendo únicamente para eso, **no son datos
reales de ninguna tienda** — el panel de vendedor y el registro de cuenta
sólo escriben contra el backend real, nunca contra ese catálogo local.

## 13. Plan de migración (resumen — parte 1 ya hecha)

Detalle completo, con qué claves de `localStorage` se retiraron y cuáles
quedan, en [`BASE_DE_DATOS.md` §3 y §6](./BASE_DE_DATOS.md). Resumen:

1. **`products` + `stores` + `users`/auth — ✅ hecho.** Era el bloqueador
   real del piloto (§11): sin esto, lo que un vendedor editaba en el panel
   no lo veía ningún comprador fuera de su propio navegador. Implementado
   en `server/` con Postgres; `product_overrides` y `users_extra` (las
   claves de `localStorage` que esto reemplazó) ya no existen.
2. **`orders` + `order_items` (carrito → pedido real)** — siguiente paso
   pendiente dentro de la Etapa 1: historial de compra real, visible desde
   cualquier dispositivo. `cartService`/`orderService` siguen en
   `localStorage` hasta entonces.
3. **`favorites_products` / `favorites_stores` / `user_vehicles`** — no
   bloquean negocio, se migran cuando el valor de "me siguen entre
   dispositivos" lo justifique.
4. **`reviews` + `store_verification_requests`** — cuando el flujo de
   reseñas y verificación de tiendas reales reemplace a los datos de
   muestra actuales.

Cada paso mueve un `services/*.js` de `localStorage` a `fetch()` sin
tocar las pantallas que lo consumen (§12) — se puede desplegar
incrementalmente, no es un "big bang".

## 14. Cuándo NO escalar todavía (guardrails)

Tan importante como saber qué se rompe primero es no construir para
problemas que no existen. Con el tamaño de piloto descrito en
`ROADMAP.md` (unas pocas tiendas reales), **no hace falta todavía**:

- Microservicios o separar el backend en varios repos/servicios.
- Un motor de búsqueda dedicado (Elasticsearch/Meilisearch) — Postgres con
  índices y `ILIKE`/full-text search alcanza hasta miles de productos.
- Cola de mensajes / arquitectura orientada a eventos entre servicios.
- Sharding o read-replicas de base de datos.
- CDN de imágenes con transformación on-the-fly — un bucket de storage con
  un tamaño fijo razonable alcanza mientras el catálogo sea chico (§9).
- Internacionalización (i18n) más allá de tener los textos en español en
  un solo lugar fácil de extraer después.

Construir cualquiera de estos ahora sería tiempo de desarrollo que no se le
dedica a validar si el modelo de negocio (comisión por transacción, tiendas
reales usando el panel de vendedor, compradores reales completando
checkout) funciona — que es la pregunta que el piloto con las tiendas del
papá del fundador está diseñado para responder primero.

## 15. Verificación y calidad

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

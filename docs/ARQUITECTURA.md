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

Una SPA estática (HTML/CSS/JS con módulos ES nativos, **sin build step,
sin framework, sin backend**) que corre 100% en el navegador y persiste
todo en `localStorage`. No es un prototipo desechable: está
deliberadamente organizada en capas para que reemplazar "sin backend" por
"con backend" sea un cambio **localizado y mecánico**, no una reescritura
(ver §12).

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

**Backend (no existe todavía — stack recomendado para la Etapa 1 del
roadmap, ver `ROADMAP.md` y `DECISIONES.md` ADR-007):**

| Pieza | Recomendación | Alternativa considerada |
|---|---|---|
| Base de datos | PostgreSQL | NoSQL (Firestore/Mongo) — descartado, el dominio es relacional (ver `DECISIONES.md`) |
| API + Auth + Storage | Supabase (Postgres + Auth + Storage administrados) para arrancar rápido | Backend propio (Node.js/Express + Postgres + JWT propio) si se prefiere control total desde ya |
| Hosting frontend | Cualquier hosting estático (Netlify, Vercel, GitHub Pages, S3+CDN) — el frontend sigue siendo estático incluso con backend real | — |

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

Hoy no hay base de datos: los catálogos viven como arrays en
`js/data/*.js` y todo lo mutable persiste en `localStorage` (inventario
completo de claves, esquema relacional objetivo en Postgres, decisiones de
diseño del esquema y plan de migración por pasos:
**[`BASE_DE_DATOS.md`](./BASE_DE_DATOS.md)**). Resumen de una línea: el
esquema objetivo ya modela `store_id`/`product_id`/etc. como si fueran
claves foráneas reales, así que migrar no exige rediseñar datos, exige
encender una base de datos detrás de un esquema que ya está pensado para
eso.

## 8. Autenticación

**Hoy (demo, sin backend):** `js/services/authService.js` valida contra un
arreglo de cuentas de muestra (`js/data/users.js`) más las cuentas creadas
vía "Registrarse" en ese navegador (`localStorage: users_extra`). La
sesión activa (`{ userId, role }`) se guarda en `localStorage: session`.
Los roles son `comprador` y `vendedor` (el panel de vendedor,
`seller.js`, sólo es accesible con rol `vendedor`).

**⚠️ Esto no es una implementación de seguridad real — es una simulación
para poder demostrar los flujos de login/registro/roles sin backend.** En
particular: las contraseñas se comparan en texto plano contra lo guardado
en `localStorage`, sin hashing. Es aceptable para un demo local; **no debe
usarse tal cual en producción bajo ninguna circunstancia** — esto se
resuelve completo en la Etapa 1 del roadmap, no es una mejora incremental
sobre lo actual, es un reemplazo.

**Objetivo (con backend — Etapa 1 del roadmap):**
- Recomendado: **Supabase Auth** (email/password +, si conviene más
  adelante, login social) — da hashing de contraseñas, verificación de
  email, y JWT ya resueltos, en vez de reconstruir esa pieza a mano.
  Alternativa igual de válida con backend propio: `bcrypt` para hashear
  contraseñas + JWT firmados por el servidor.
- El frontend deja de guardar la sesión "cruda" en `localStorage` y pasa a
  guardar sólo un **token** (JWT), enviado en cada request como
  `Authorization: Bearer <token>` (ver §10).
- Autorización por rol (`comprador`/`vendedor`/`admin`, ver
  `BASE_DE_DATOS.md`) se valida en el backend en cada endpoint sensible
  (ej. sólo el dueño de una tienda puede editar su inventario) — hoy esa
  validación sólo existe en el cliente (`seller.js` revisa `user.role`),
  lo cual es trivial de saltarse porque no hay servidor que lo haga
  cumplir. Esto es aceptable en un demo sin datos reales; **no** lo es en
  cuanto haya inventario/pedidos reales de terceros.
- Si se usa Supabase/Postgres, conviene apoyarse en **Row Level Security
  (RLS)** para que, por ejemplo, "un vendedor sólo puede leer/escribir
  productos de su propia tienda" sea una regla de la base de datos, no
  sólo del código de la API — una capa de seguridad menos dependiente de
  que nadie se olvide de un `if`.

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

**Hoy no existe** — el "backend" es el propio navegador
(`services/*.js` resolviendo contra `localStorage` con una latencia
artificial para simular una llamada de red real, ver
`js/services/productService.js`). Pero el contrato ya está definido, y es
exactamente el contrato que tendría una API real (ver §12).

**Objetivo, cuando exista backend:**

| Aspecto | Convención |
|---|---|
| Protocolo | HTTPS, API REST convencional (`GET/POST/PATCH/DELETE`) |
| Formato | JSON en request y response |
| Rutas | `/api/<recurso>` — ej. `/api/products`, `/api/products/:id`, `/api/stores/:id/products`, `/api/orders`, `/api/auth/login` |
| Autenticación | Header `Authorization: Bearer <jwt>` en cada request autenticado (ver §8) |
| Errores | Códigos de estado HTTP correctos (400/401/403/404/409/500) + body `{ "error": "mensaje legible" }`. El frontend ya tiene el hábito de esto: los servicios devuelven `{ ok: false, error }` en vez de lanzar excepciones para errores esperables (ver `authService.login`, `orderService.checkout`) — mismo patrón, ahora alimentado por la respuesta real del API en vez de una validación local |
| CORS | Si el frontend se sirve desde un dominio distinto al de la API (lo más probable — frontend estático + API en Supabase/servidor propio), la API debe permitir el origen del frontend explícitamente |
| Paginación | No existe hoy (los catálogos son chicos). Al crecer, `GET /api/products?page=2&pageSize=20` — convención simple, no cursor-based, mientras el volumen no lo exija |

**Por qué esto ya "existe" en la práctica:** cada función de
`services/*.js` tiene la forma `async nombre(args) → Promise<Resultado>`,
sin exponer nunca que hoy resuelve contra `localStorage`. Conectar el
backend real es reemplazar el cuerpo de esas funciones por `fetch(...)`
contra las rutas de la tabla de arriba — el ejemplo concreto está en §12.

## 11. Qué se rompe primero si esto crece sin cambiar nada

Ordenado por qué tan pronto se vuelve un problema real:

| Límite actual | Por qué existe | Cuándo se vuelve bloqueante |
|---|---|---|
| `localStorage` es **por navegador**, no por cuenta | No hay backend | Inmediatamente en cuanto haya una tienda real: el vendedor edita su inventario en su navegador y **ningún comprador en otro dispositivo lo ve**. Este es el bloqueador #1 antes del piloto — ver `ROADMAP.md`, Etapa 0. |
| Autenticación sin hashing de contraseñas ni autorización real en servidor | No hay backend (ver §8) | Bloqueante para cualquier dato real de terceros — no es "mejorable después", es un reemplazo completo antes de manejar cuentas/inventario reales. |
| `productService.search()` filtra un array en memoria | No hay base de datos | Deja de ser instantáneo bien antes de "millones de productos" — con cientos de tiendas y miles de productos ya conviene un índice real (Postgres con índices, luego un motor de búsqueda si hace falta relevancia). No es un problema a los 50–200 productos de un piloto. |
| No hay control de concurrencia de inventario | No hay base de datos | En cuanto dos compradores puedan comprar la última unidad del mismo producto al mismo tiempo. Bloqueante para cualquier operación con inventario real ajustado (no antes). |
| El carrito y la sesión no sobreviven a "borrar datos del navegador" | Diseño intencional del MVP | Aceptable para demo/piloto controlado; no aceptable para un usuario real que cambia de teléfono o borra caché. |
| Sin SEO / sin server-side rendering | SPA pura, contenido no indexable por buscadores | Bloqueante el día que la adquisición de compradores dependa de tráfico orgánico de Google hacia páginas de producto/tienda. No bloqueante mientras la adquisición sea directa (referidos, redes sociales, boca a boca del piloto). |
| Un solo idioma, una sola moneda (USD, sin formateo por locale) | No hace falta todavía | Bloqueante sólo al expandir fuera de Venezuela o a un mercado con otra moneda dominante. |
| Sin panel de analítica/eventos | No implementado | No bloquea el piloto; sí bloquea decidir con datos qué mejorar después del piloto — conviene instrumentarlo apenas haya usuarios reales, no antes (ver `ROADMAP.md`). |

## 12. Cómo se conecta a un backend real (mecánica del cambio)

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
por servicio**, no todo de una vez (ver §13).

## 13. Plan de migración (resumen)

Detalle completo, con qué claves de `localStorage` se retiran en cada
paso, en [`BASE_DE_DATOS.md` §4](./BASE_DE_DATOS.md). Resumen:

1. **`products` + `stores` + `product_compatibility`** — el bloqueador
   real del piloto (§11): sin esto, lo que un vendedor edita en el panel
   no lo ve ningún comprador fuera de su propio navegador.
2. **`users` (con auth real, §8) + `orders` + `order_items`** — historial
   y sesión reales, entre dispositivos.
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

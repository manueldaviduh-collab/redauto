# Base de datos de RedAuto

Dos cosas viven en este documento: **lo que existe hoy** (datos en memoria
+ `localStorage`, sin servidor) y **el esquema objetivo** para cuando
exista un backend real (ver `ROADMAP.md`, Etapa 1). Se documentan juntos a
propósito: el esquema objetivo está diseñado para que los datos de hoy
mapeen a él sin sorpresas.

## 1. Modelo de datos actual (sin backend)

### 1.1. Catálogos en memoria (`js/data/*.js`)

Son arrays estáticos, embebidos en el bundle de JS, iguales para cualquier
persona que abra la app. `productService` los fusiona con los "overrides"
que un vendedor haya guardado localmente (ver 1.2) antes de devolverlos.

| Archivo | Entidad | Campos principales |
|---|---|---|
| `categories.js` | Categoría | `id, name, icon` |
| `vehicles.js` | Catálogo marca/modelo/año | `brands[]`, `modelsByBrand{}`, `years[]` |
| `stores.js` | Tienda | `id, name, city, address, phone, verified, verification{status,since}, rating, reviewsCount, yearsInRedAuto, salesCount, onTimeDeliveryPct, categories[], delivery{shipping,pickup}, deliveryOptions[], hours, responseTime, about, initials` |
| `products.js` | Producto | `id, name, categoryId, partBrand, type(original\|alternativo), price, originalPrice, availability, stock, storeId, rating, reviewsCount, sku, description, compatibility[{brand,model,yearFrom,yearTo}]` |
| `users.js` | Usuario demo + pedidos demo | `demoUsers[]`, `demoOrders[]` (ver 1.2, checkout) |
| `notifications.js` | Notificaciones de muestra | `id, type, title, body, date` |
| `reviews.js` | Reseñas de muestra | generadas por producto, `author, rating, comment, daysAgo` |

**Nota importante:** `products[].storeId` y `stores[].categories[]` ya
existen como si fueran claves foráneas, aunque hoy no haya base de datos
relacional detrás. Esto es deliberado (ver `DECISIONES.md`): el día que
esto se mueva a Postgres, `storeId` se vuelve literalmente una `FOREIGN
KEY`, no hay que inventarla.

### 1.2. Lo que persiste en `localStorage`

Todo bajo el prefijo `redauto_` (ver `js/services/storage.js`). Es
**por navegador**, no por cuenta — ver `ARQUITECTURA.md` §6 para por qué
esto es el bloqueador #1 antes de cualquier piloto con usuarios reales.

| Clave (`redauto_<clave>`) | Servicio dueño | Contenido |
|---|---|---|
| `session` | `authService` | `{ userId, role }` de la sesión activa |
| `users_extra` | `authService` | Cuentas creadas vía "Registrarse" en este navegador |
| `cart` | `cartService` | `[{ productId, qty }]` |
| `garage_vehicles` | `vehicleService` | `[{ id, brand, model, year, engine }]` — "Mis Vehículos" |
| `garage_active_id` | `vehicleService` | id del vehículo activo (impulsa compatibilidad inteligente) |
| `favorites` | `favoritesService` | `[productId]` |
| `favorite_stores` | `favoritesService` | `[storeId]` |
| `orders_local` | `orderService` | Pedidos creados en checkout en este navegador |
| `product_overrides` | `productService` | `{ added: Product[], edited: { [id]: Partial<Product> } }` — altas/ediciones del panel de vendedor |
| `notifications_read` | `notificationService` | `[notificationId]` leídos |
| `city_pref` | `home.js` (directo) | Ciudad elegida en el selector del header |

## 2. Esquema objetivo (cuando exista backend — Etapa 1 del roadmap)

Diseñado para Postgres (ver `DECISIONES.md` para por qué relacional y no
NoSQL). Se muestra en forma de tabla por legibilidad; los tipos son
orientativos (Postgres real).

```
users
├─ id                 uuid PK
├─ name                text
├─ email                citext UNIQUE
├─ password_hash          text
├─ phone                   text NULL
├─ city                     text NULL
├─ role                      enum('comprador','vendedor','admin')
└─ created_at                 timestamptz

stores
├─ id                  uuid PK
├─ owner_user_id        uuid FK → users.id
├─ name                   text
├─ slug                    text UNIQUE        -- para URLs /tienda/:slug
├─ city, address, phone     text
├─ whatsapp                  text NULL
├─ hours                      text
├─ response_time_minutes       int NULL
├─ verification_status          enum('pendiente','en_revision','verificada','rechazada')
├─ verified_since                 date NULL
├─ about                            text
├─ logo_url, cover_url               text NULL
├─ rating_cached, reviews_count_cached, sales_count_cached, on_time_delivery_pct
│                                      -- cachés denormalizados; fuente de verdad = reviews/orders
└─ created_at                          timestamptz

categories
├─ id     uuid PK
├─ slug    text UNIQUE
├─ name     text
└─ icon      text

vehicle_brands            vehicle_models
├─ id  uuid PK             ├─ id         uuid PK
└─ name text UNIQUE         ├─ brand_id    FK → vehicle_brands.id
                             └─ name         text

products
├─ id                   uuid PK
├─ store_id              FK → stores.id
├─ category_id            FK → categories.id
├─ name, part_brand, sku    text
├─ type                       enum('original','alternativo')
├─ description                  text
├─ price_cents, original_price_cents_nullable   int   -- SIEMPRE enteros, nunca float (ver §3)
├─ currency                        char(3) default 'USD'
├─ stock                            int
├─ availability                      enum('en_stock','bajo_pedido','agotado')
├─ created_at, updated_at              timestamptz
INDEX (store_id), INDEX (category_id), INDEX (availability)

product_images
├─ id          uuid PK
├─ product_id   FK → products.id
├─ url            text
└─ position         int             -- orden de la galería

product_compatibility
├─ id                uuid PK
├─ product_id          FK → products.id
├─ vehicle_brand_id      FK → vehicle_brands.id NULL   -- NULL = universal
├─ vehicle_model_id        FK → vehicle_models.id NULL -- NULL = toda la marca
├─ year_from, year_to        int
INDEX (vehicle_brand_id, vehicle_model_id, year_from, year_to)
                              -- la consulta más caliente de toda la app: "qué
                              -- productos sirven para esta marca/modelo/año"

user_vehicles                                       -- "Mis Vehículos"
├─ id             uuid PK
├─ user_id          FK → users.id
├─ brand_id, model_id  FK
├─ year, engine_nullable
├─ is_active            boolean
└─ created_at

orders                                    order_items
├─ id           uuid PK                    ├─ id             uuid PK
├─ user_id        FK → users.id             ├─ order_id         FK → orders.id
├─ status           enum(...)                ├─ product_id         FK → products.id
├─ subtotal_cents,                            ├─ store_id             FK → stores.id  -- redundante a propósito
│  shipping_cents,                            ├─ qty
│  total_cents         int                     ├─ unit_price_cents    -- copia del precio AL MOMENTO de comprar
├─ currency               char(3)               └─ product_name_snapshot text
├─ shipping_name/phone/                             -- (ver §3: por qué se copian estos datos)
│  city/address              text
├─ delivery_method              enum('envio','retiro')
├─ payment_status                 enum('pendiente','pagado','reembolsado')
├─ payment_method                   text NULL
└─ created_at                          timestamptz
INDEX (user_id), INDEX (status)     -- order_items: INDEX (order_id), INDEX (store_id)

favorites_products (user_id, product_id, created_at)   PK (user_id, product_id)
favorites_stores    (user_id, store_id,   created_at)   PK (user_id, store_id)

reviews
├─ id          uuid PK
├─ user_id       FK → users.id
├─ order_id        FK → orders.id            -- reseña ligada a una compra verificada
├─ product_id NULL   FK → products.id          -- una de las dos, no ambas NULL
├─ store_id NULL       FK → stores.id
├─ rating                 smallint (1-5)
├─ comment                  text
└─ created_at

notifications
├─ id            uuid PK
├─ user_id         FK → users.id
├─ type              text
├─ title, body         text
├─ related_order_id NULL FK → orders.id
├─ read_at                timestamptz NULL
└─ created_at                timestamptz
INDEX (user_id, read_at)

store_verification_requests            -- futuro flujo real de KYC (ver ROADMAP)
├─ id             uuid PK
├─ store_id         FK → stores.id
├─ document_urls[]     text[]
├─ status                enum('pendiente','en_revision','aprobada','rechazada')
├─ reviewed_by NULL         FK → users.id
├─ reviewed_at NULL            timestamptz
└─ notes                          text NULL
```

## 3. Decisiones de diseño ya tomadas en el esquema (y por qué)

- **Dinero como enteros (`_cents`), nunca `float`.** Sumar/restar floats
  para totales de carrito produce errores de redondeo reales, no
  teóricos. Se guarda en centavos enteros y se formatea a `$XX.XX` sólo en
  la capa de presentación. `productService`/`cartService` ya calculan
  todo con `price` como número simple porque hoy es un MVP sin backend;
  al migrar, la conversión a centavos enteros se hace en la capa del API,
  no antes.
- **`order_items` copia `unit_price_cents` y `product_name_snapshot`.** Un
  pedido es un documento histórico: si la tienda después cambia el precio
  o el nombre del producto, el pedido ya hecho **no debe cambiar**. Sin
  este snapshot, el historial de compras del comprador (`profile.js`,
  "Mis pedidos") mostraría precios distintos a los que realmente pagó.
- **`store_id` en `order_items`, no sólo en `orders`.** Un carrito puede
  tener productos de varias tiendas a la vez (así es hoy en la app). Guardar
  `store_id` a nivel de línea, no de pedido completo, es lo que permite que
  `sellerService.getDashboard()` calcule "mis ventas" sin tener que asumir
  que un pedido pertenece a una sola tienda — esto ya es así en el
  `orderService.getOrdersForStore()` actual (filtra por ítem, no por
  pedido) y el esquema objetivo simplemente lo hace explícito con una
  columna en vez de un filtro en memoria.
- **`product_compatibility` es su propia tabla, no un JSON embebido.** Hoy
  vive como un array `compatibility[]` dentro de cada producto porque no
  hay base de datos. En Postgres, sacarlo a tabla propia con el índice
  compuesto `(vehicle_brand_id, vehicle_model_id, year_from, year_to)` es
  lo que hace que "buscar repuestos para mi Corolla 2018" sea una consulta
  indexada en vez de un `WHERE` sobre JSON — la consulta más frecuente de
  toda la app se vuelve barata desde el primer día de backend.
- **Reseñas ligadas a `order_id`.** Para que "reseña verificada" signifique
  algo real (solo quien compró puede reseñar), no un campo de texto libre
  sin respaldo.
- **`rating_cached` / `reviews_count_cached` en `stores`.** Denormalizados
  a propósito: recalcular el promedio de reseñas en cada carga de la
  pantalla de tienda es caro sin necesidad. Se recalculan async cuando
  entra una reseña nueva, no en cada lectura.

## 4. Plan de migración (de `localStorage` a Postgres)

No es un solo salto. Orden recomendado, cada uno desbloquea al siguiente:

1. **`products` + `stores` + `product_compatibility`** — es el bloqueador
   real del piloto (ver `ARQUITECTURA.md` §6): sin esto, lo que un
   vendedor edita en el panel no lo ve ningún comprador fuera de ese mismo
   navegador. `product_overrides` (localStorage) se descarta en este punto
   — ya no hace falta, el backend es la única fuente de verdad.
2. **`users` + `orders` + `order_items`** — habilita que un comprador vea
   su historial real desde cualquier dispositivo, y que un vendedor vea
   pedidos reales en su dashboard. `orders_local`/`session` (localStorage)
   se retiran.
3. **`favorites_products` / `favorites_stores` / `user_vehicles`** — estas
   tres pueden quedarse en `localStorage` más tiempo sin bloquear nada de
   negocio (no impiden comprar ni vender); se migran cuando el valor de
   "mis favoritos me siguen entre dispositivos" lo justifique.
4. **`reviews` + `store_verification_requests`** — cuando el flujo de
   reseñas de compradores reales y de verificación de tiendas dejen de ser
   datos de muestra (ver `ROADMAP.md`, Etapa 2).

En cada paso, el contrato de `services/*.js` no cambia (ver
`ARQUITECTURA.md` §7) — sólo cambia qué hay detrás de la función.

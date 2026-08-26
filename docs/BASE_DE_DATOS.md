# Base de datos de RedAuto

Tres cosas viven en este documento: **el esquema real que ya corre en
Postgres** (`server/src/schema.sql`), **lo que todavía vive en
`localStorage`** del lado del cliente, y **el esquema objetivo completo**
para cuando el resto (pedidos, reseñas, imágenes, verificación de tienda)
también se mueva a backend. Se documentan juntos a propósito: el esquema
objetivo fue diseñado desde el principio para que lo que hoy vive en
memoria/localStorage mapeara a él sin sorpresas, y esa apuesta ya se
verificó al implementar la primera porción.

## 1. Qué vive dónde, hoy (resumen)

| Entidad | Dónde vive | Estado |
|---|---|---|
| Categorías | PostgreSQL (`server/`) | Real — única siembra del esquema, es taxonomía fija, no datos ficticios |
| Cuentas de usuario / autenticación | PostgreSQL (`server/`) | Real — contraseñas con `bcrypt`, sesión con JWT (ver `ARQUITECTURA.md` §8) |
| Tiendas | PostgreSQL (`server/`) | Real — se crean únicamente vía registro de vendedor en la app, cero tiendas de muestra insertadas por script |
| Productos | PostgreSQL (`server/`) | Real — se crean únicamente desde el panel de vendedor, siempre resolviendo la tienda dueña desde el token (nunca del body) |
| Carrito | `localStorage` | Simulado — pendiente de migrar a `orders`/checkout real |
| Pedidos / "Mis pedidos" | `localStorage` + datos de muestra (`js/data/users.js: demoOrders`) | Simulado |
| Favoritos (productos y tiendas) | `localStorage` | Simulado — no bloquea negocio, ver §6 |
| Garage de "Mis Vehículos" | `localStorage` | Simulado |
| Notificaciones | `localStorage` + datos de muestra | Simulado |
| Reseñas | Generadas en memoria (muestra) | Simulado |

La navegación de compra (Home/Buscar/Tiendas) combina el catálogo real de
Postgres con un catálogo de demostración que sigue viviendo en
`js/data/products.js`/`stores.js`, **sólo** para que esas pantallas nunca
se vean vacías si el backend no responde (ver `ARQUITECTURA.md` §10). Los
namespaces de id no chocan a propósito: lo de muestra usa `p1`..`p24` /
`st1`..`st5`, lo real del backend usa UUIDs. El panel de vendedor y el
registro de cuenta **sólo** escriben contra el backend real — nunca contra
ese catálogo de muestra.

## 2. Esquema implementado hoy (PostgreSQL, `server/src/schema.sql`)

Cuatro tablas, deliberadamente el subconjunto mínimo para "una empresa
real se registra y publica productos" — no el esquema objetivo completo
(§4) todavía.

```
users
├─ id             uuid PK (gen_random_uuid())
├─ name            text
├─ email            text  -- único, case-insensitive (índice sobre LOWER(email))
├─ password_hash      text  -- bcrypt, nunca texto plano
├─ phone, city          text NULL
├─ role                   text  CHECK IN ('comprador','vendedor')
└─ created_at                timestamptz

categories                          -- única tabla con datos sembrados
├─ id     text PK  (ej. 'frenos')      -- 8 categorías reales del dominio,
├─ name    text                         -- no es un dato ficticio de negocio,
└─ icon     text                         -- es taxonomía fija de la app

stores
├─ id                   uuid PK
├─ owner_user_id          uuid FK → users.id   -- UNIQUE: 1 usuario = máximo 1 tienda propia
├─ name, city, address, phone, about  text NULL
├─ verification_status      text  CHECK IN ('pendiente','verificada','rechazada')
│                              -- default 'verificada': toda tienda que se
│                              -- autorregistra queda verificada automáticamente
│                              -- hoy — simplificación deliberada del piloto,
│                              -- no un KYC real (ver ARQUITECTURA.md §8)
└─ created_at                    timestamptz

products
├─ id                     uuid PK
├─ store_id                 uuid FK → stores.id
├─ category_id                text FK → categories.id
├─ name, part_brand, sku        text
├─ type                            text  CHECK IN ('original','alternativo')
├─ description                       text NULL
├─ price_cents                         int  CHECK >= 0        -- entero, nunca float (ver §5)
├─ original_price_cents                  int NULL CHECK >= price_cents
├─ stock                                    int  CHECK >= 0
├─ availability                                text CHECK IN ('en_stock','bajo_pedido','agotado')
├─ created_at, updated_at                        timestamptz
INDEX (store_id), INDEX (category_id)
```

No existe todavía `product_images` (fotos van como ilustración SVG
generada en cliente, ver `ARQUITECTURA.md` §9), ni `product_compatibility`
como tabla propia (el formulario del panel de vendedor no captura
compatibilidad por vehículo todavía — cada producto nuevo recibe un valor
por defecto "Universal / Todas / 2000–2026" en la vista que consume el
frontend, ver `toProductViewModel` en `server/src/routes/products.js`).
Ninguna de las dos bloquea el objetivo de esta etapa (registrar tienda +
publicar producto); se agregan cuando el panel de vendedor capture esos
datos de verdad.

## 3. Lo que todavía vive en `localStorage`

Todo bajo el prefijo `redauto_` (ver `js/services/storage.js`), **por
navegador, no por cuenta** — ver `ARQUITECTURA.md` §11 para el impacto de
esto en lo que todavía no migró.

| Clave (`redauto_<clave>`) | Servicio dueño | Contenido |
|---|---|---|
| `auth_token` | `authService` | JWT de la sesión activa contra el backend real (reemplazó a la vieja clave `session`, que guardaba `{userId, role}` sin firmar) |
| `auth_session` | `authService` | Copia cacheada de `{usuario, storeId}` para lectura síncrona (`getCurrentUser()` la usan `profile.js`/`seller.js`/`checkout.js` sin `await`); se refresca contra `GET /api/auth/me` (`refreshSession()`) |
| `cart` | `cartService` | `[{ productId, qty }]` |
| `garage_vehicles` | `vehicleService` | `[{ id, brand, model, year, engine }]` — "Mis Vehículos" |
| `garage_active_id` | `vehicleService` | id del vehículo activo (impulsa compatibilidad inteligente) |
| `favorites` | `favoritesService` | `[productId]` |
| `favorite_stores` | `favoritesService` | `[storeId]` |
| `orders_local` | `orderService` | Pedidos creados en checkout en este navegador (se combinan con `demoOrders` de `js/data/users.js`) |
| `notifications_read` | `notificationService` | `[notificationId]` leídos |
| `city_pref` | `home.js` (directo) | Ciudad elegida en el selector del header |

**Retiradas al implementar el backend real:** `session` y `users_extra`
(reemplazadas por `auth_token`/`auth_session` arriba) y
`product_overrides` (el panel de vendedor escribe directo contra
`POST/PATCH /api/products`, ya no guarda altas/ediciones en el navegador).

## 4. Esquema objetivo completo (cuando también migre pedidos, reseñas, imágenes, verificación)

Diseñado para Postgres desde antes de que existiera backend (ver
`DECISIONES.md`, ADR-007). Las tablas marcadas **✅ implementada** ya
corren tal cual en `server/src/schema.sql` (versión más chica, sin las
columnas todavía no necesarias, ver diffs anotados); el resto es el
objetivo para las siguientes etapas (`ROADMAP.md`).

```
users                     ✅ implementada (versión más chica: sin columna role='admin' todavía)
├─ id                 uuid PK
├─ name                text
├─ email                citext UNIQUE
├─ password_hash          text
├─ phone                   text NULL
├─ city                     text NULL
├─ role                      enum('comprador','vendedor','admin')
└─ created_at                 timestamptz

stores                   ✅ implementada (versión más chica: sin slug/whatsapp/hours/
├─ id                        response_time/logo/cover/campos cacheados todavía)
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

categories                ✅ implementada (versión más chica: id text en vez de uuid+slug)
├─ id     uuid PK
├─ slug    text UNIQUE
├─ name     text
└─ icon      text

vehicle_brands            vehicle_models              -- objetivo, no implementado:
├─ id  uuid PK             ├─ id         uuid PK          hoy no hay catálogo
└─ name text UNIQUE         ├─ brand_id    FK → vehicle_brands.id   estructurado de marca/
                             └─ name         text                    modelo en backend

products                 ✅ implementada (versión más chica: sin currency,
├─ id                        sin product_images/product_compatibility como tablas)
├─ store_id              FK → stores.id
├─ category_id            FK → categories.id
├─ name, part_brand, sku    text
├─ type                       enum('original','alternativo')
├─ description                  text
├─ price_cents, original_price_cents_nullable   int   -- SIEMPRE enteros, nunca float (ver §5)
├─ currency                        char(3) default 'USD'
├─ stock                            int
├─ availability                      enum('en_stock','bajo_pedido','agotado')
├─ created_at, updated_at              timestamptz
INDEX (store_id), INDEX (category_id), INDEX (availability)

product_images             -- objetivo, no implementado: fotos siguen siendo
├─ id          uuid PK         ilustración SVG generada en cliente (ARQUITECTURA.md §9)
├─ product_id   FK → products.id
├─ url            text
└─ position         int             -- orden de la galería

product_compatibility        -- objetivo, no implementado: el formulario del panel
├─ id                            de vendedor no captura compatibilidad por vehículo
├─ product_id          FK → products.id       todavía (cada producto nuevo queda
├─ vehicle_brand_id      FK → vehicle_brands.id NULL   "Universal / Todas" por defecto)
├─ vehicle_model_id        FK → vehicle_models.id NULL
├─ year_from, year_to        int
INDEX (vehicle_brand_id, vehicle_model_id, year_from, year_to)
                              -- la consulta más caliente de toda la app: "qué
                              -- productos sirven para esta marca/modelo/año"

user_vehicles                                       -- objetivo, no implementado:
├─ id             uuid PK                              "Mis Vehículos" sigue en
├─ user_id          FK → users.id                       localStorage (garage_vehicles)
├─ brand_id, model_id  FK
├─ year, engine_nullable
├─ is_active            boolean
└─ created_at

orders                                    order_items       -- objetivo, no implementado:
├─ id           uuid PK                    ├─ id             uuid PK   carrito y checkout
├─ user_id        FK → users.id             ├─ order_id         FK → orders.id  siguen en
├─ status           enum(...)                ├─ product_id         FK → products.id  localStorage
├─ subtotal_cents,                            ├─ store_id             FK → stores.id  -- redundante a propósito
│  shipping_cents,                            ├─ qty
│  total_cents         int                     ├─ unit_price_cents    -- copia del precio AL MOMENTO de comprar
├─ currency               char(3)               └─ product_name_snapshot text
├─ shipping_name/phone/                             -- (ver §5: por qué se copian estos datos)
│  city/address              text
├─ delivery_method              enum('envio','retiro')
├─ payment_status                 enum('pendiente','pagado','reembolsado')
├─ payment_method                   text NULL
└─ created_at                          timestamptz
INDEX (user_id), INDEX (status)     -- order_items: INDEX (order_id), INDEX (store_id)

favorites_products (user_id, product_id, created_at)   PK (user_id, product_id)   -- objetivo,
favorites_stores    (user_id, store_id,   created_at)   PK (user_id, store_id)     -- no implementado

reviews                                -- objetivo, no implementado
├─ id          uuid PK
├─ user_id       FK → users.id
├─ order_id        FK → orders.id            -- reseña ligada a una compra verificada
├─ product_id NULL   FK → products.id          -- una de las dos, no ambas NULL
├─ store_id NULL       FK → stores.id
├─ rating                 smallint (1-5)
├─ comment                  text
└─ created_at

notifications                          -- objetivo, no implementado
├─ id            uuid PK
├─ user_id         FK → users.id
├─ type              text
├─ title, body         text
├─ related_order_id NULL FK → orders.id
├─ read_at                timestamptz NULL
└─ created_at                timestamptz
INDEX (user_id, read_at)

store_verification_requests            -- objetivo, no implementado: hoy toda
├─ id             uuid PK                  tienda queda "verificada" automáticamente
├─ store_id         FK → stores.id            al registrarse (ver §2 y ARQUITECTURA.md §8)
├─ document_urls[]     text[]
├─ status                enum('pendiente','en_revision','aprobada','rechazada')
├─ reviewed_by NULL         FK → users.id
├─ reviewed_at NULL            timestamptz
└─ notes                          text NULL
```

## 5. Decisiones de diseño ya tomadas en el esquema (y por qué)

- **Dinero como enteros (`_cents`), nunca `float`.** Sumar/restar floats
  para totales de carrito produce errores de redondeo reales, no
  teóricos. Se guarda en centavos enteros en Postgres (`products.price_cents`,
  ya implementado) y se formatea a `$XX.XX` sólo en la capa de
  presentación — la conversión centavos↔dólares vive en la frontera del
  API (`toCents`/`toDollars` en `server/src/routes/products.js`), nunca
  antes. El carrito, que todavía no tiene backend, sigue calculando con
  `price` como número simple hasta que se migre (§6).
- **`order_items` copia `unit_price_cents` y `product_name_snapshot`**
  (objetivo, no implementado — ver tabla `orders` arriba). Un pedido es un
  documento histórico: si la tienda después cambia el precio o el nombre
  del producto, el pedido ya hecho **no debe cambiar**. Sin este
  snapshot, el historial de compras del comprador mostraría precios
  distintos a los que realmente pagó.
- **`store_id` en `order_items`, no sólo en `orders`** (objetivo). Un
  carrito puede tener productos de varias tiendas a la vez (así es hoy en
  la app). Guardar `store_id` a nivel de línea, no de pedido completo, es
  lo que permite que `sellerService.getDashboard()` calcule "mis ventas"
  sin asumir que un pedido pertenece a una sola tienda — esto ya es así
  en el `orderService.getOrdersForStore()` actual (filtra por ítem, no
  por pedido) y el esquema objetivo simplemente lo hace explícito con una
  columna en vez de un filtro en memoria.
- **`product_compatibility` sería su propia tabla, no un JSON embebido**
  (objetivo). Hoy vive como un array `compatibility[]` con un valor por
  defecto fijo dentro de cada producto (§2), porque el panel de vendedor
  no lo captura todavía. En Postgres, sacarlo a tabla propia con el
  índice compuesto `(vehicle_brand_id, vehicle_model_id, year_from,
  year_to)` es lo que hace que "buscar repuestos para mi Corolla 2018"
  sea una consulta indexada en vez de un filtro sobre JSON.
- **Reseñas ligadas a `order_id`** (objetivo). Para que "reseña
  verificada" signifique algo real (solo quien compró puede reseñar), no
  un campo de texto libre sin respaldo.
- **`rating_cached` / `reviews_count_cached` en `stores`** (objetivo).
  Denormalizados a propósito: recalcular el promedio de reseñas en cada
  carga de la pantalla de tienda es caro sin necesidad. Se recalculan
  async cuando entra una reseña nueva, no en cada lectura. Hoy
  `server/src/routes/stores.js` devuelve honestamente `rating: 0`,
  `reviewsCount: 0`, etc. para tiendas reales — nunca un número inventado
  — hasta que exista el flujo real de reseñas.

## 6. Plan de migración de lo que falta

Detalle de qué ya se movió está en §1 y §3. Orden recomendado para el
resto, cada uno desbloquea al siguiente:

1. **`orders` + `order_items`** — habilita que un comprador vea su
   historial real desde cualquier dispositivo, y que un vendedor vea
   pedidos reales (no `demoOrders`) en su dashboard. `orders_local`/`cart`
   (`localStorage`) se retiran en este paso.
2. **`favorites_products` / `favorites_stores` / `user_vehicles`** — estas
   tres pueden quedarse en `localStorage` más tiempo sin bloquear nada de
   negocio (no impiden comprar ni vender); se migran cuando el valor de
   "mis favoritos me siguen entre dispositivos" lo justifique.
3. **`reviews` + `store_verification_requests`** — cuando el flujo de
   reseñas de compradores reales y de verificación de tiendas reemplace a
   los datos de muestra actuales (ver `ROADMAP.md`, Etapa 2).
4. **`product_images` + storage real** — cuando el panel de vendedor
   permita subir fotos reales (ver `ARQUITECTURA.md` §9).

En cada paso, el contrato de `services/*.js` no cambia (ver
`ARQUITECTURA.md` §12) — sólo cambia qué hay detrás de la función, tal
como ya pasó con `authService`/`productService`/`storeService`/
`sellerService`.

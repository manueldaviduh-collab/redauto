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
| Tiendas | PostgreSQL (`server/`) | Real — RIF, responsable, WhatsApp, dirección, estado, categorías; quedan **pendientes de verificación**, no se auto-publican |
| Productos + compatibilidad de vehículos | PostgreSQL (`server/`) | Real — a mano o por importación masiva de Excel; compatibilidad (marca/modelo/año/motor/versión) obligatoria y real, ya no un default "Universal" |
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

Siete tablas — el subconjunto necesario para "una empresa real se
registra, carga su inventario completo (a mano o por Excel) con
compatibilidad de vehículos real, y un admin la aprueba antes de que sea
pública". `product_images` ya existe en el esquema pero vacía todavía (ver
§4 y `ARQUITECTURA.md` §9 para por qué).

```
users
├─ id             uuid PK (gen_random_uuid())
├─ name            text
├─ email            text  -- único, case-insensitive (índice sobre LOWER(email))
├─ password_hash      text  -- bcrypt, nunca texto plano
├─ phone, city          text NULL
├─ role                   text  CHECK IN ('comprador','vendedor','admin')
│                            -- 'admin' se agregó para aprobar tiendas (ver
│                            -- server/README.md, "Aprobar una tienda") —
│                            -- nadie lo tiene por defecto, se asigna a mano
└─ created_at                timestamptz

categories                          -- única tabla con datos sembrados
├─ id     text PK  (ej. 'frenos')      -- 8 categorías reales del dominio,
├─ name    text                         -- no es un dato ficticio de negocio,
└─ icon     text                         -- es taxonomía fija de la app

stores
├─ id                   uuid PK
├─ owner_user_id          uuid FK → users.id   -- UNIQUE: 1 usuario = máximo 1 tienda propia
├─ name, rif, responsible_name             text NULL
├─ city, state, address, phone, whatsapp     text NULL
├─ logo_url                                    text NULL  -- listo para cuando haya subida real de logo
├─ about                                          text NULL
├─ verification_status      text  CHECK IN ('pendiente','verificada','rechazada')
│                              -- default 'pendiente': toda tienda que se
│                              -- autorregistra queda pendiente hasta que un
│                              -- admin la aprueba a mano — GET /api/stores y
│                              -- GET /api/products solo muestran tiendas
│                              -- 'verificada' (ver server/README.md)
└─ created_at                    timestamptz

store_categories                    -- categorías que la tienda declara
├─ store_id     uuid FK → stores.id     vender al registrarse, antes incluso
└─ category_id   text FK → categories.id de tener productos cargados
PK (store_id, category_id)

products
├─ id                     uuid PK
├─ store_id                 uuid FK → stores.id
├─ category_id                text FK → categories.id
├─ name, part_brand, sku        text
├─ type                            text  CHECK IN ('original','alternativo')
├─ description                       text NULL
├─ internal_location                   text NULL  -- ubicación en el almacén, solo la ve el vendedor
├─ price_cents                           int  CHECK >= 0        -- entero, nunca float (ver §5)
├─ original_price_cents                    int NULL CHECK >= price_cents
├─ stock                                      int  CHECK >= 0
├─ availability                                  text CHECK IN ('en_stock','bajo_pedido','agotado')
├─ created_at, updated_at                          timestamptz
INDEX (store_id), INDEX (category_id)
UNIQUE (store_id, sku) WHERE sku IS NOT NULL  -- permite reimportar el mismo
                                               -- Excel sin duplicar productos

product_compatibility          -- una fila por cada vehículo compatible;
├─ id                uuid PK      un producto puede tener varias
├─ product_id          FK → products.id
├─ vehicle_brand, vehicle_model      text NOT NULL
├─ year_from, year_to                  int NULL
├─ engine, vehicle_trim                  text NULL
└─ created_at                               timestamptz
INDEX (product_id), INDEX (vehicle_brand, vehicle_model)

product_images                 -- existe, pero vacía: sin proveedor de
├─ id            uuid PK           almacenamiento conectado todavía (ver §4)
├─ product_id      FK → products.id
├─ url               text NOT NULL
├─ position             int  -- orden de la galería, 0 = foto principal
└─ created_at              timestamptz
INDEX (product_id)
```

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
users                     ✅ implementada (incluye role='admin', ver server/README.md)
├─ id                 uuid PK
├─ name                text
├─ email                citext UNIQUE
├─ password_hash          text
├─ phone                   text NULL
├─ city                     text NULL
├─ role                      enum('comprador','vendedor','admin')
└─ created_at                 timestamptz

stores                   ✅ implementada (versión más chica: sin slug/hours/
├─ id                        response_time/cover/campos cacheados todavía;
├─ owner_user_id        uuid FK → users.id   rif/responsible_name sí están, no en el diseño original)
├─ name, rif, responsible_name   text
├─ slug                    text UNIQUE        -- objetivo, no implementado: URLs /tienda/:slug
├─ city, state, address, phone, whatsapp  text
├─ hours                      text                -- objetivo, no implementado
├─ response_time_minutes       int NULL              -- objetivo, no implementado
├─ verification_status          enum('pendiente','verificada','rechazada')  -- default 'pendiente' ✅
├─ about                            text
├─ logo_url                           text NULL  -- columna lista; sin subida real todavía (ver §4.1)
├─ cover_url                             text NULL  -- objetivo, no implementado
├─ rating_cached, reviews_count_cached, sales_count_cached, on_time_delivery_pct
│                                      -- objetivo, no implementado: hoy la API devuelve 0/null honesto
└─ created_at                          timestamptz

store_categories          ✅ implementada — categorías que la tienda declara vender al registrarse
├─ store_id   FK → stores.id
└─ category_id FK → categories.id

categories                ✅ implementada (versión más chica: id text en vez de uuid+slug)
├─ id     uuid PK
├─ slug    text UNIQUE
├─ name     text
└─ icon      text

vehicle_brands            vehicle_models              -- objetivo, no implementado:
├─ id  uuid PK             ├─ id         uuid PK          product_compatibility ya es real
└─ name text UNIQUE         ├─ brand_id    FK → vehicle_brands.id   (ver abajo) pero marca/modelo
                             └─ name         text                    son texto libre, no FK a un
                                                                       catálogo cerrado — decisión
                                                                       deliberada, ver §5

products                 ✅ implementada (versión más chica: sin currency)
├─ id
├─ store_id              FK → stores.id
├─ category_id            FK → categories.id
├─ name, part_brand, sku    text
├─ type                       enum('original','alternativo')
├─ description                  text
├─ internal_location              text NULL  -- ubicación en almacén, solo la ve el vendedor
├─ price_cents, original_price_cents_nullable   int   -- SIEMPRE enteros, nunca float (ver §5)
├─ currency                        char(3) default 'USD'  -- objetivo, no implementado (todo es USD hoy)
├─ stock                            int
├─ availability                      enum('en_stock','bajo_pedido','agotado')
├─ created_at, updated_at              timestamptz
INDEX (store_id), INDEX (category_id), INDEX (availability)
UNIQUE (store_id, sku) WHERE sku IS NOT NULL  -- para que reimportar el mismo Excel actualice, no duplique

product_images             ✅ implementada — tabla lista y en uso por la API,
├─ id          uuid PK         pero vacía: sin proveedor de almacenamiento de
├─ product_id   FK → products.id  imágenes conectado todavía (ver §4.1 y ARQUITECTURA.md §9)
├─ url            text
└─ position         int             -- orden de la galería

product_compatibility        ✅ implementada — obligatoria al crear un producto
├─ id                            (a mano o por Excel), reemplazó el default
├─ product_id          FK → products.id       "Universal / Todas" que se usaba antes
├─ vehicle_brand, vehicle_model      text NOT NULL  -- texto libre, no FK (ver arriba)
├─ year_from, year_to        int NULL
├─ engine, vehicle_trim        text NULL
INDEX (product_id), INDEX (vehicle_brand, vehicle_model)
                              -- la consulta más caliente de toda la app: "qué
                              -- productos sirven para esta marca/modelo/año"

-- (ver §4.1 más abajo para el diseño de subida real de fotos y su
-- importación masiva, ambas sobre esta misma tabla product_images)

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

store_verification_requests            -- objetivo, no implementado: hoy la
├─ id             uuid PK                  aprobación es un solo campo
├─ store_id         FK → stores.id            (stores.verification_status) que
├─ document_urls[]     text[]                    cambia un admin a mano por SQL/API
├─ status                enum('pendiente','en_revision','aprobada','rechazada')  (ver server/README.md) — sin
├─ reviewed_by NULL         FK → users.id           subida de documentos ni historial
├─ reviewed_at NULL            timestamptz             de revisión todavía
└─ notes                          text NULL
```

### 4.1. Diseño (sin implementar) — subida real de fotos y su importación masiva

`product_images` ya existe y la API ya la lee/devuelve (§2) — lo único que
falta es *quién escribe filas ahí*. Diseño para cuando se conecte un
proveedor de almacenamiento (Cloudinary es el candidato más simple —
`ARQUITECTURA.md` §9 y `DECISIONES.md` ya lo señalan como la opción sin
Supabase):

- **Subida individual** (panel de vendedor, un producto a la vez):
  `POST /api/products/:id/images` recibe un archivo (`multipart/form-data`,
  igual que ya hace `POST /api/products/import/preview` con Excel — mismo
  patrón, `multer` en memoria, nunca a disco). El handler sube el buffer al
  proveedor de storage, y solo si eso responde bien inserta la fila en
  `product_images` con la URL real que devuelva. `DELETE
  /api/products/:id/images/:imageId` y `PATCH .../images/:imageId`
  (reordenar, cambiar `position`) completan el CRUD.
- **Importación masiva** (la pieza que pide el punto 6 del pedido de
  onboarding): dos variantes, ambas escriben sobre la misma tabla:
  - **ZIP con imágenes**: el nombre de archivo dentro del ZIP es el SKU
    (`UI-001.jpg`, `UI-001-2.jpg` para una segunda foto del mismo
    producto) — el backend descomprime en memoria, sube cada imagen al
    proveedor, y asocia por SKU al producto ya existente de esa tienda
    (mismo mecanismo de "agrupar por SKU" que ya usa
    `productImportParser.js` para Excel).
  - **URLs por columna en el Excel**: agregar una columna
    `foto_url_1`/`foto_url_2`/... a la plantilla — el backend descarga
    cada URL (con límite de tamaño y timeout) y la resube al proveedor
    propio, en vez de enlazar la URL externa directo (para no depender de
    que seguir existiendo un sitio de terceros).
- Ninguna de las dos necesita otra tabla: la API de productos ya devuelve
  `images: string[]` (vacío hoy, ver `toProductViewModel` en
  `server/src/routes/products.js`) — cuando haya URLs reales ahí, conectar
  la UI es cambiar `productTile()`
  (`js/ui/components.js`) para usar la primera foto si existe y sólo caer
  al SVG generado como *fallback* — sin tocar ninguna pantalla que ya
  llama a `productTile()`.

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
- **`product_compatibility` es su propia tabla, no un JSON embebido — ✅
  implementada.** El objetivo de esto (§2) era que "buscar repuestos para
  mi Corolla 2018" fuera una consulta indexada en vez de un filtro sobre
  JSON — el índice `(vehicle_brand, vehicle_model)` ya existe, listo para
  cuando el frontend agregue esa búsqueda del lado del comprador (hoy la
  compatibilidad ya es real y obligatoria al cargar un producto, pero
  "Buscar repuestos para mi auto" en `home.js` todavía filtra sobre el
  catálogo combinado en memoria, no contra este índice).
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
3. **`reviews`** — cuando el flujo de reseñas de compradores reales
   reemplace a los datos de muestra actuales (ver `ROADMAP.md`, Etapa 2).
   **`store_verification_requests`** — la aprobación de tiendas ya es real
   (`stores.verification_status`, ver §4.1 y `server/README.md`), esta
   tabla es para cuando ese flujo necesite subida de documentos e historial
   de revisión en vez de un solo campo que cambia un admin a mano.
4. **`product_images` (subida real de fotos)** — diseño completo en §4.1,
   pendiente de conectar un proveedor de almacenamiento externo.
4. **`product_images` + storage real** — cuando el panel de vendedor
   permita subir fotos reales (ver `ARQUITECTURA.md` §9).

En cada paso, el contrato de `services/*.js` no cambia (ver
`ARQUITECTURA.md` §12) — sólo cambia qué hay detrás de la función, tal
como ya pasó con `authService`/`productService`/`storeService`/
`sellerService`.

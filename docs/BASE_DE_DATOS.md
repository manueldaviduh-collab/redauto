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
| Carrito (antes de comprar) | `localStorage` | Simulado, a propósito — borrador de compra de bajo riesgo, ver §6 |
| Pedidos / "Mis pedidos" | PostgreSQL (`server/`) | Real — precio y nombre congelados al momento de la compra, visibles desde cualquier dispositivo |
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

Nueve tablas — el subconjunto necesario para "una empresa real se
registra, carga su inventario completo (a mano o por Excel, con fotos
reales) con compatibilidad de vehículos real, un admin la aprueba antes de
que sea pública, y un comprador completa un pedido real que persiste".

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

product_images                 -- subida real a Cloudinary (ver
├─ id            uuid PK           ARQUITECTURA.md §9)
├─ product_id      FK → products.id
├─ url               text NOT NULL
├─ public_id           text NULL  -- id en Cloudinary, para poder borrar la imagen ahí también
├─ position               int  -- orden de la galería, 0 = foto principal
└─ created_at                timestamptz
INDEX (product_id)

orders                       -- pedido real; status sólo con estados que se
├─ id            uuid PK        pueden respaldar sin pasarela de pago ni
├─ buyer_user_id   FK → users.id  envíos conectados (ver §5)
├─ status            text CHECK IN ('pendiente_pago','pagado','cancelado')
├─ shipping_name/phone/
│  address/city         text NULL
├─ total_cents               int
└─ created_at                   timestamptz
INDEX (buyer_user_id)

order_items                  -- una fila por línea de carrito; store_id
├─ id             uuid PK       propio permite filtrar "mis ventas" por
├─ order_id         FK → orders.id  tienda sin asumir 1 pedido = 1 tienda
├─ store_id            FK → stores.id
├─ product_id            FK → products.id NULL (ON DELETE SET NULL)
├─ product_name_snapshot   text NOT NULL  -- nombre al momento de comprar
├─ unit_price_cents           int  -- precio al momento de comprar
├─ qty                           int CHECK > 0
└─ created_at                       timestamptz
INDEX (order_id), INDEX (store_id)
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
| `notifications_read` | `notificationService` | `[notificationId]` leídos |
| `city_pref` | `home.js` (directo) | Ciudad elegida en el selector del header |

**Retiradas al implementar el backend real:** `session` y `users_extra`
(reemplazadas por `auth_token`/`auth_session` arriba); `product_overrides`
(el panel de vendedor escribe directo contra `POST/PATCH /api/products`,
ya no guarda altas/ediciones en el navegador); `orders_local` (`orderService`
ahora crea pedidos reales vía `POST /api/orders` — ver tabla `orders` más
abajo). `cart` sigue en `localStorage`, a propósito: es borrador de compra
antes de confirmar, de bajo riesgo, no un dato de negocio que se pierda si
desaparece.

## 4. Esquema objetivo completo (cuando también migren reseñas, favoritos, "Mis Vehículos")

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
├─ logo_url                           text NULL  -- columna lista; sin subida real todavía (logo de tienda, no fotos de producto — ver §4.1)
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

product_images             ✅ implementada — subida real a Cloudinary conectada
├─ id          uuid PK         (ver ARQUITECTURA.md §9 y server/src/routes/products.js).
├─ product_id   FK → products.id  Sigue vacía hasta que cada tienda suba sus fotos.
├─ url            text
├─ public_id       text NULL      -- id de Cloudinary, para poder borrar la imagen ahí también
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

orders                                    order_items       -- ✅ implementadas
├─ id           uuid PK                    ├─ id             uuid PK   (versión más chica,
├─ buyer_user_id  FK → users.id             ├─ order_id         FK → orders.id  ver abajo)
├─ status           enum('pendiente_pago',   ├─ store_id             FK → stores.id
│                    'pagado','cancelado')   ├─ product_id           FK → products.id NULL
├─ total_cents               int              │                        (ON DELETE SET NULL)
├─ shipping_name/phone/                       ├─ product_name_snapshot text
│  address/city              text             ├─ unit_price_cents    -- copia del precio AL MOMENTO de comprar
└─ created_at                    timestamptz  ├─ qty
INDEX (buyer_user_id)                         └─ created_at
                                             INDEX (order_id), INDEX (store_id)

-- Versión más chica que el diseño original de esta sección: sin
-- subtotal_cents/shipping_cents separados (sólo total_cents — no hay
-- cálculo de envío real todavía, ver ARQUITECTURA.md §11), sin currency
-- (todo USD, igual que products), sin delivery_method/payment_method (no
-- hay pasarela ni logística conectada). Se agregan cuando haya algo real
-- detrás, no antes (ver DECISIONES.md sobre no construir para hipótesis).
-- status usa sólo estados que se pueden respaldar de verdad — nunca
-- "en camino"/"entregado" sin seguimiento real (PRINCIPIOS.md §4).
-- El carrito (antes de convertirse en un order) sigue en localStorage —
-- decisión deliberada, ver server/README.md "Pedidos reales".

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

### 4.1. Subida real de fotos (✅ implementada) y su importación masiva (diseño, sin implementar)

**Subida individual — implementada.** `product_images` ya existe, la API
ya la lee/devuelve (§2), y desde esta versión también escribe filas ahí de
verdad, subiendo a **Cloudinary** (`ARQUITECTURA.md` §9 y `DECISIONES.md`
ya lo señalaban como la opción sin Supabase):
- `POST /api/products/:id/images` (panel de vendedor, un producto a la
  vez) recibe un archivo (`multipart/form-data`, igual que
  `POST /api/products/import/preview` con Excel — mismo patrón, `multer`
  en memoria, nunca a disco). El handler sube el buffer a Cloudinary
  (`server/src/services/imageStorage.js`), y solo si eso responde bien
  inserta la fila en `product_images` con la URL real que devuelve.
  `DELETE /api/products/:id/images/:imageId` y
  `PATCH .../images/:imageId` (reordena intercambiando posición con la
  foto vecina) completan el CRUD. Máximo 8 fotos por producto.
  Si el servidor no tiene las credenciales de Cloudinary configuradas
  (variables `CLOUDINARY_*`, ver `server/.env.example`), estos tres
  endpoints responden `503` en vez de fallar — el resto de la API sigue
  funcionando.
- `js/screens/seller.js` (formulario de producto, sección "Fotos") deja
  previsualizar localmente antes de guardar (para un producto nuevo, se
  suben recién al guardar el producto) y agregar/borrar/reordenar en vivo
  para uno ya existente.
- `productTile()` (`js/ui/components.js`) usa la primera foto real si el
  producto tiene alguna, y sólo cae al SVG de `productArt.js` como
  *fallback* cuando no hay ninguna — así quedó conectado sin tocar ninguna
  pantalla que ya llama a `productTile()`.

**Importación masiva de fotos — sigue sin implementar, a propósito** (el
pedido de onboarding pidió explícitamente "sólo preparar la estructura").
Dos variantes, ambas escribirían sobre la misma tabla `product_images`
reutilizando el endpoint de subida individual ya construido arriba:
  - **ZIP con imágenes**: el nombre de archivo dentro del ZIP es el SKU
    (`UI-001.jpg`, `UI-001-2.jpg` para una segunda foto del mismo
    producto) — el backend descomprime en memoria, sube cada imagen a
    Cloudinary, y asocia por SKU al producto ya existente de esa tienda
    (mismo mecanismo de "agrupar por SKU" que ya usa
    `productImportParser.js` para Excel).
  - **URLs por columna en el Excel**: agregar una columna
    `foto_url_1`/`foto_url_2`/... a la plantilla — el backend descarga
    cada URL (con límite de tamaño y timeout) y la resube a Cloudinary, en
    vez de enlazar la URL externa directo (para no depender de que siga
    existiendo un sitio de terceros).

## 5. Decisiones de diseño ya tomadas en el esquema (y por qué)

- **Dinero como enteros (`_cents`), nunca `float`.** Sumar/restar floats
  para totales de carrito produce errores de redondeo reales, no
  teóricos. Se guarda en centavos enteros en Postgres (`products.price_cents`,
  ya implementado) y se formatea a `$XX.XX` sólo en la capa de
  presentación — la conversión centavos↔dólares vive en la frontera del
  API (`toCents`/`toDollars` en `server/src/routes/products.js`), nunca
  antes. El carrito, que no tiene backend a propósito (ver §6, paso 1),
  sigue calculando con `price` como número simple.
- **`order_items` copia `unit_price_cents` y `product_name_snapshot` — ✅
  implementada.** Un pedido es un documento histórico: si la tienda
  después cambia el precio o el nombre del producto, el pedido ya hecho
  **no cambia** — `POST /api/orders` congela ambos valores al momento de
  la compra, nunca los vuelve a leer de `products` después.
- **`store_id` en `order_items`, no sólo en `orders` — ✅ implementada.**
  Un carrito puede tener productos de varias tiendas a la vez. Guardar
  `store_id` a nivel de línea, no de pedido completo, es lo que permite que
  `GET /api/orders/store` calcule "mis ventas" sin asumir que un pedido
  pertenece a una sola tienda — el total que ve cada vendedor es sólo el de
  sus propias líneas, no el del pedido completo.
  **Simplificación deliberada:** `orders.status` sigue siendo un solo
  campo para todo el pedido, no uno por tienda — si un carrito mezcla dos
  tiendas, cualquiera de los dos vendedores puede marcar el pedido completo
  como pagado. Correcto en el caso común (un pedido = una tienda);
  documentado como límite conocido, no un bug.
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

1. **`orders` + `order_items` — ✅ hecho.** Un comprador ve su historial
   real desde cualquier dispositivo, y un vendedor ve pedidos reales (no
   `demoOrders`) en su dashboard. `orders_local` se retiró; `cart` se queda
   en `localStorage` a propósito (borrador de compra de bajo riesgo, no un
   dato de negocio — ver `server/README.md`, "Pedidos reales").
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
4. **`product_images` (subida real de fotos) — ✅ hecho**, ver §4.1 y
   `ARQUITECTURA.md` §9. Sólo queda pendiente la importación masiva de
   fotos (ZIP o URLs por Excel), diseñada en §4.1 pero deliberadamente sin
   construir todavía.

En cada paso, el contrato de `services/*.js` no cambia (ver
`ARQUITECTURA.md` §12) — sólo cambia qué hay detrás de la función, tal
como ya pasó con `authService`/`productService`/`storeService`/
`sellerService`.

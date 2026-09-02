# RedAuto — Backend real

API mínima (Node.js + Express + PostgreSQL) para que **una tienda real
pueda registrarse y publicar productos reales** en RedAuto. Implementa el
subconjunto de [`docs/BASE_DE_DATOS.md`](../docs/BASE_DE_DATOS.md)
necesario para eso — es la Etapa 1 de [`docs/ROADMAP.md`](../docs/ROADMAP.md),
ya arrancada, no sólo planeada.

**No hay datos de muestra.** `src/schema.sql` no crea ningún usuario,
tienda ni producto — la única siembra son las categorías (Motor, Frenos,
Suspensión, etc.), que son taxonomía de la app, no un negocio ficticio. La
base de datos arranca vacía y se llena únicamente con lo que se registre de
verdad desde la app.

## Qué hace (y qué no, todavía)

Hace:
- Registro de cuenta (comprador, o vendedor + su tienda en la misma
  transacción) con RIF, responsable, WhatsApp, dirección, estado y
  categorías que vende — contraseña hasheada (bcrypt), sesión con JWT.
  **La tienda queda "pendiente de verificación"**, no se publica sola (ver
  "Aprobar una tienda" más abajo).
- Login.
- Alta y edición de productos, siempre resolviendo la tienda dueña desde el
  token — nunca desde lo que mande el cliente. Cada producto exige al
  menos un vehículo compatible (marca/modelo/año/motor/versión) — se
  guarda como datos reales, no como texto libre.
- **Importación masiva por Excel** (`/api/products/import/*`): plantilla
  descargable, vista previa con validación por fila antes de tocar la base,
  e importación de cientos/miles de productos con sus compatibilidades.
  Re-subir el mismo SKU actualiza el producto en vez de duplicarlo.
- Edición de la información de la propia tienda (`PATCH /api/stores/mine`).
- **Subida real de fotos de producto** (`/api/products/:id/images/*`):
  hasta 8 fotos por producto, subidas a Cloudinary — agregar, borrar y
  reordenar. Si el servidor no tiene Cloudinary configurado, estos
  endpoints responden `503` en vez de romper el resto de la API.
- **Logo real de tienda** (`/api/stores/mine/logo`): una foto subida a
  Cloudinary igual que las de producto (mismo `imageStorage.js` detrás) —
  reemplazarla borra la anterior en Cloudinary, y una tienda sin logo
  todavía sigue mostrando sus iniciales sobre el degradado de marca en la
  navegación, nunca un espacio roto.
- Lectura pública de tiendas y productos — **solo de tiendas ya
  verificadas**: una tienda pendiente o rechazada nunca aparece en el
  catálogo público, aunque ya tenga productos cargados.
- **Panel de administración con interfaz** (`#/admin` en el frontend, sólo
  visible/accesible para cuentas con rol `admin`): lista de tiendas por
  estado (pendientes/verificadas/rechazadas/todas), con botones para
  aprobar o rechazar. Ver "Panel de administración" más abajo.
- **Pedidos reales** (`/api/orders/*`): un comprador autenticado registra un
  pedido real a partir de su carrito — precio y nombre de cada línea se
  resuelven siempre del lado del servidor y quedan congelados (si el
  producto cambia de precio después, el pedido ya hecho no cambia). Visible
  desde cualquier dispositivo, tanto para el comprador (`GET /orders/mine`)
  como para cada tienda involucrada (`GET /orders/store`). Sin pasarela de
  pago conectada: el vendedor confirma a mano que cobró
  (`PATCH /orders/:id/status`).

Todavía no hace (ver `docs/ROADMAP.md` para el orden en que se agrega):
pagos automatizados, envíos con seguimiento real, importación masiva de
fotos (ZIP o URLs por Excel — diseño en `docs/BASE_DE_DATOS.md` §4.1, la
subida individual ya sí es real), reseñas, notificaciones push. El carrito
(antes de convertirse en pedido) sigue en `localStorage` del navegador —
ver "Pedidos reales" más abajo para por qué eso es una decisión, no un
pendiente.

## Requisitos

- Node.js 18+
- PostgreSQL 14+ (local, o cualquier proveedor: Supabase, Railway, Neon,
  RDS, etc. — cualquiera que te dé una cadena `postgresql://...` sirve,
  esto no depende de Supabase específicamente aunque sea la recomendación
  de `docs/ARQUITECTURA.md`)

## Correrlo en local

```bash
cd server
npm install

# Crea la base y el usuario si no los tienes ya (ejemplo con un Postgres
# local corriendo como superusuario "postgres"):
#   sudo -u postgres psql -c "CREATE ROLE redauto WITH LOGIN PASSWORD 'elige-una-clave';"
#   sudo -u postgres psql -c "CREATE DATABASE redauto OWNER redauto;"

cp .env.example .env
# Edita .env: DATABASE_URL con tu conexión real, y genera un JWT_SECRET propio:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

npm run migrate    # crea las tablas + siembra las categorías (nada más)
npm start          # http://localhost:4000 — probar con: curl http://localhost:4000/api/health
```

Con el backend arriba, apunta el frontend a él: en `index.html` (raíz del
proyecto), la línea `window.REDAUTO_API_URL = 'http://localhost:4000/api'`
ya es ese valor por defecto — no hay que tocar nada más para desarrollo
local.

## Desplegarlo para que sea alcanzable por usuarios reales

Este backend es un servidor Node.js común — no necesita nada exótico.
Cualquiera de estas combinaciones funciona:

1. **Más simple:** Railway o Render (ambos pueden alojar el servicio Node
   *y* darte una base Postgres administrada en el mismo lugar). Conectas
   este repo (carpeta `server/`), defines las variables de entorno de
   `.env.example` en su panel, y listo.
2. **Base de datos en Supabase + servidor en Railway/Render/Fly.io:**
   Supabase te da el `DATABASE_URL` de Postgres (con `DATABASE_SSL=true`);
   el servidor Express corre en cualquier otro proveedor apuntando a esa
   base. Esta combinación además deja lista la migración futura a Supabase
   Auth/Storage si se necesita (ver `docs/ARQUITECTURA.md` §8 y §9).

En cualquier caso, después de desplegar:
- Corre `npm run migrate` una vez contra la base de producción (crea las
  tablas — sigue sin insertar ningún dato de muestra).
- Actualiza `CORS_ORIGIN` en las variables de entorno del servidor al
  dominio real donde sirvas el frontend (no dejar `*` en producción).
- Cambia `window.REDAUTO_API_URL` en el `index.html` del frontend a la URL
  pública del backend desplegado.

## Conectar Cloudinary (subida real de fotos)

Sin esto, la API funciona igual, pero subir/borrar/reordenar fotos de
producto responde `503`. Para activarlo:

1. Crea una cuenta gratis en [cloudinary.com](https://cloudinary.com/users/register_free).
2. En su Dashboard, copia **Cloud Name**, **API Key** y **API Secret**
   (botón "Go to API Keys").
3. Ponlos como variables de entorno del servidor (en `.env` local, o en el
   panel de tu proveedor en producción):
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
4. Reinicia el servidor. No hace falta tocar el esquema para esto — sólo
   asegúrate de tener la columna `product_images.public_id` (ver siguiente
   sección si tu base es de antes de esta versión).

## Actualizar una base ya desplegada (esquema nuevo)

`src/schema.sql` es **seguro de volver a correr** sobre una base que ya
tenía el esquema anterior: usa `CREATE TABLE/INDEX ... IF NOT EXISTS` y
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, así que solo aplica lo que
falte, nunca borra ni duplica nada. Si ya tenías RedAuto desplegado antes
de que existieran los campos de tienda (RIF, WhatsApp, etc.), la
compatibilidad de vehículos o la importación por Excel: vuelve a pegar el
contenido completo de `src/schema.sql` en la consola de tu proveedor de
Postgres (o `psql "$DATABASE_URL" -f src/schema.sql` si tienes `psql` a
mano) y listo — las tiendas y productos que ya tenías **no se tocan**.

## Panel de administración

Toda tienda que se autorregistra queda `verification_status = 'pendiente'`
— no es visible para compradores hasta que se apruebe.

**Opción normal — el panel con interfaz (`#/admin` en el frontend):**
lista de tiendas por estado, con botones "Aprobar"/"Rechazar" y un enlace
para previsualizar la tienda antes de decidir. Para que una cuenta pueda
entrar, primero necesita el rol `admin` — **nadie lo tiene por defecto, ni
hay forma de dárselo desde la app**; se asigna a mano, una sola vez por
persona, después de que esa persona ya se haya registrado normal:
```sql
UPDATE users SET role = 'admin' WHERE email = 'correo-de-la-persona@ejemplo.com';
```
Con esa cuenta logueada, en el menú de "Mi cuenta" aparece **"Panel de
administración"**. Cada acción del panel (listar, aprobar, rechazar) se
revalida contra este mismo rol del lado del servidor — no es sólo una
pantalla oculta, el backend rechaza la petición igual si alguien intenta
llamarla sin el rol.

**Opción SQL directa** (sirve para casos puntuales sin pasar por el panel):
```sql
-- Ver las tiendas pendientes
SELECT id, name, rif, city, state, created_at FROM stores WHERE verification_status = 'pendiente';

-- Aprobar una
UPDATE stores SET verification_status = 'verificada' WHERE id = 'el-id-de-la-tienda';
```

**Opción API directa** (lo que usa el panel por debajo):
```
GET /api/stores/admin?status=pendiente
PATCH /api/stores/:id/verification
Authorization: Bearer <token de una cuenta admin>
{ "status": "verificada" }   -- o "rechazada"
```

## Pedidos reales

Antes vivían enteros en `localStorage` (por navegador: un pedido no se veía
en otro dispositivo, y el panel de vendedor mostraba pedidos de ejemplo, no
reales). Ahora:

- El **carrito** (antes de confirmar la compra) sigue en `localStorage` del
  navegador — a propósito, no es un pendiente: es borrador de compra, de
  bajo riesgo, y moverlo a la base de datos hoy exigiría cuentas hasta para
  mirar el catálogo, que no es lo que se pidió.
- El **pedido** (lo que se crea al confirmar en el checkout) es real desde
  el primer clic: `POST /api/orders` resuelve precio y nombre de cada línea
  del lado del servidor (nunca de lo que mande el cliente) y los congela
  (`product_name_snapshot`/`unit_price_cents`) — si la tienda después
  cambia el precio o borra el producto, el pedido ya hecho no cambia.
- Sólo acepta productos reales de tiendas ya verificadas. La app ya no
  tiene ningún catálogo de muestra (ver `docs/DECISIONES.md`, ADR-008),
  pero por si el carrito trae un id que no exista de verdad en esta base
  (formato inválido o producto borrado), esa línea se descarta y la
  respuesta lo avisa (`skippedCount`) en vez de fingir que se compró.
- Estados honestos solamente: `pendiente_pago` (recién creado) →
  `pagado` (la tienda confirma que cobró, coordinado aparte por WhatsApp/
  transferencia) o `cancelado`. Nunca "en camino"/"entregado" — eso
  implicaría un seguimiento de envío que no existe todavía (ver
  `docs/PRINCIPIOS.md` §4).
- `GET /api/orders/mine` (comprador) y `GET /api/orders/store` (vendedor,
  resuelve su tienda del token) son de sólo lectura, cada quien ve lo suyo.
  `PATCH /api/orders/:id/status` lo usa el vendedor para marcar
  pagado/cancelado — nota: el estado es del pedido completo, no por tienda
  (un carrito puede mezclar productos de varias tiendas); cualquier
  vendedor con al menos una línea en ese pedido puede cambiarlo, lo cual es
  exactamente correcto en el caso común (un pedido = una tienda).

## Cómo cargar tu propia tienda (sin pasos de demostración)

Una vez que el backend esté corriendo (local o desplegado) y el frontend
apunte a él:

1. Abre la app → **Crear cuenta**.
2. Completa tus datos reales, marca **"Quiero vender en RedAuto (registrar
   mi tienda)"** y llena el nombre de la tienda, RIF, responsable,
   WhatsApp, dirección, estado y las categorías que vendes.
3. Al confirmar, quedas autenticado como vendedor de esa tienda (ya creada
   en la base de datos, en estado **pendiente de verificación**) y la app
   te lleva directo al **Panel de vendedor → Inventario**.
4. Ahí puedes cargar tu inventario completo aunque la tienda siga
   pendiente — **Agregar producto** uno por uno (con su compatibilidad de
   vehículos y hasta 8 fotos reales), o **Importar por Excel** para cargar
   muchos de una vez (descarga la plantilla desde el mismo botón; las
   fotos se cargan aparte, producto por producto).
5. Apruébate la tienda (ver "Panel de administración" arriba) — recién ahí
   se vuelve visible para compradores. El inventario ya cargado no hay que
   volver a tocarlo, aparece solo apenas se aprueba.

No hace falta ninguna consola de base de datos para los pasos 1-4 — es el
mismo flujo que usará cualquier tienda real que se registre después. El
paso 5 sigue siendo una decisión humana a propósito (nunca automática),
pero ya tiene una pantalla — no hace falta SQL para el día a día.

## Referencia rápida de endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| GET | `/api/health` | — | Chequeo de vida |
| POST | `/api/auth/register` | — | Cuenta (+ tienda pendiente si hay `storeName`) — ver campos en `routes/auth.js` |
| POST | `/api/auth/login` | — | `{email,password}` → `{token,user,store}` |
| GET | `/api/auth/me` | Bearer | Cuenta + tienda de la sesión actual |
| GET | `/api/products` | — | Catálogo público (solo tiendas verificadas); filtros `?categoryId=&storeId=&availability=&type=&query=` |
| GET | `/api/products/:id` | — | Un producto (solo si su tienda está verificada) |
| GET | `/api/products/mine/list` | Bearer (vendedor) | Inventario completo de tu tienda, sin importar el estado de verificación |
| POST | `/api/products` | Bearer (vendedor) | Crear producto — `compatibility: [{brand,model,yearFrom?,yearTo?,engine?,trim?}]` obligatorio (mínimo 1) |
| PATCH | `/api/products/:id` | Bearer (vendedor) | Editar un producto tuyo; si mandas `compatibility`, reemplaza la lista completa |
| GET | `/api/products/import/template` | — | Descarga la plantilla oficial de Excel (.xlsx) |
| POST | `/api/products/import/preview` | Bearer (vendedor) | Sube un `.xlsx` (`multipart/form-data`, campo `file`) → valida sin escribir nada |
| POST | `/api/products/import/commit` | Bearer (vendedor) | Sube el mismo archivo → importa (upsert por SKU) |
| GET | `/api/products/:id/images` | Bearer (vendedor) | Fotos del producto (con id, para poder borrar/reordenar) |
| POST | `/api/products/:id/images` | Bearer (vendedor) | Sube una foto (`multipart/form-data`, campo `file`) — máx. 8 por producto; `503` si Cloudinary no está configurado |
| DELETE | `/api/products/:id/images/:imageId` | Bearer (vendedor) | Borra una foto (base + Cloudinary) |
| PATCH | `/api/products/:id/images/:imageId` | Bearer (vendedor) | Reordena — body `{"direction":"up"\|"down"}` |
| GET | `/api/stores` | — | Tiendas verificadas |
| GET | `/api/stores/:id` | — (admin ve cualquiera) | Una tienda + su catálogo resumido; pública sólo si está verificada |
| GET | `/api/stores/mine` | Bearer (vendedor) | Tu tienda, sin importar el estado de verificación |
| PATCH | `/api/stores/mine` | Bearer (vendedor) | Editar los datos de tu tienda (nunca su verificación) |
| POST | `/api/stores/mine/logo` | Bearer (vendedor) | Sube/reemplaza el logo de tu tienda (`multipart/form-data`, campo `file`) — `503` si Cloudinary no está configurado |
| DELETE | `/api/stores/mine/logo` | Bearer (vendedor) | Quita el logo (vuelve a mostrar iniciales en la navegación) |
| GET | `/api/stores/admin` | Bearer (admin) | Todas las tiendas, cualquier estado — `?status=pendiente\|verificada\|rechazada` filtra |
| PATCH | `/api/stores/:id/verification` | Bearer (admin) | Aprobar/rechazar una tienda — ver "Panel de administración" arriba |
| POST | `/api/orders` | Bearer | Crea un pedido real desde el carrito — `{items:[{productId,qty}], shipping:{name,phone,address,city}}` |
| GET | `/api/orders/mine` | Bearer | Tu historial de pedidos como comprador |
| GET | `/api/orders/store` | Bearer (vendedor) | Pedidos con al menos un producto de tu tienda |
| PATCH | `/api/orders/:id/status` | Bearer (vendedor) | Marca un pedido tuyo como pagado/cancelado — `{"status":"pagado"}` |

## Seguridad — qué ya está y qué falta antes de manejar datos sensibles reales

Ya está: contraseñas con hash (nunca en texto plano), sesión firmada (JWT),
cada escritura de producto verificada contra el dueño real de la tienda
(nunca confía en un `storeId` que mande el cliente), **tiendas nuevas
pendientes de verificación real** (ya no se auto-verifican), y tanto la
importación por Excel como la subida de fotos corren en memoria (nunca
escriben el archivo subido a disco) — cada foto además se verifica contra
el producto de la tienda dueña antes de subirla o borrarla.

Falta antes de un uso con más volumen/sensibilidad (ver
`docs/ARQUITECTURA.md` §8 y `docs/ROADMAP.md`): límite de intentos de
login (rate limiting), rotación/expiración más corta de tokens si hace
falta, un panel de administración con interfaz para aprobar tiendas (hoy es
SQL/API directo — funcional, pero manual).

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
- Lectura pública de tiendas y productos — **solo de tiendas ya
  verificadas**: una tienda pendiente o rechazada nunca aparece en el
  catálogo público, aunque ya tenga productos cargados.

Todavía no hace (ver `docs/ROADMAP.md` para el orden en que se agrega):
carrito/pedidos reales, pagos, envíos, subida real de fotos (pendiente de
conectar un proveedor de almacenamiento — ver `docs/ARQUITECTURA.md` §9),
reseñas, notificaciones push, panel de administración con interfaz (la
aprobación de tiendas hoy es por SQL o por API, ver abajo). El frontend
sigue resolviendo carrito/pedidos en `localStorage`, documentado en el
README raíz.

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

## Aprobar una tienda

Toda tienda que se autorregistra queda `verification_status = 'pendiente'`
— no es visible para compradores hasta que se apruebe. Todavía no hay un
panel de administración con interfaz (ver `docs/ROADMAP.md`, Etapa 2), así
que aprobar/rechazar se hace de una de estas dos formas:

**Opción rápida — SQL directo** (recomendada mientras seas tú el único
revisando tiendas):
```sql
-- Ver las tiendas pendientes
SELECT id, name, rif, city, state, created_at FROM stores WHERE verification_status = 'pendiente';

-- Aprobar una
UPDATE stores SET verification_status = 'verificada' WHERE id = 'el-id-de-la-tienda';
```

**Opción API** (ya construida, útil si en el futuro armas un panel encima):
primero necesitas una cuenta con rol `admin` — ningún usuario lo tiene por
defecto:
```sql
UPDATE users SET role = 'admin' WHERE email = 'tu-correo@ejemplo.com';
```
Con esa cuenta logueada (mismo `POST /api/auth/login` de siempre, el token
ya trae el rol), aprobar o rechazar:
```
PATCH /api/stores/:id/verification
Authorization: Bearer <token de una cuenta admin>
{ "status": "verificada" }   -- o "rechazada"
```

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
   vehículos), o **Importar por Excel** para cargar muchos de una vez
   (descarga la plantilla desde el mismo botón).
5. Apruébate la tienda (ver "Aprobar una tienda" arriba) — recién ahí se
   vuelve visible para compradores. El inventario ya cargado no hay que
   volver a tocarlo, aparece solo apenas se aprueba.

No hace falta ninguna consola de base de datos para los pasos 1-4 — es el
mismo flujo que usará cualquier tienda real que se registre después. El
paso 5 sí es manual hoy, a propósito (ver "Qué hace" arriba).

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
| GET | `/api/stores` | — | Tiendas verificadas |
| GET | `/api/stores/:id` | — | Una tienda + su catálogo resumido |
| GET | `/api/stores/mine` | Bearer (vendedor) | Tu tienda, sin importar el estado de verificación |
| PATCH | `/api/stores/mine` | Bearer (vendedor) | Editar los datos de tu tienda (nunca su verificación) |
| PATCH | `/api/stores/:id/verification` | Bearer (admin) | Aprobar/rechazar una tienda — ver "Aprobar una tienda" arriba |

## Seguridad — qué ya está y qué falta antes de manejar datos sensibles reales

Ya está: contraseñas con hash (nunca en texto plano), sesión firmada (JWT),
cada escritura de producto verificada contra el dueño real de la tienda
(nunca confía en un `storeId` que mande el cliente), **tiendas nuevas
pendientes de verificación real** (ya no se auto-verifican), y la
importación por Excel corre en memoria (nunca escribe el archivo subido a
disco).

Falta antes de un uso con más volumen/sensibilidad (ver
`docs/ARQUITECTURA.md` §8 y `docs/ROADMAP.md`): límite de intentos de
login (rate limiting), rotación/expiración más corta de tokens si hace
falta, un panel de administración con interfaz para aprobar tiendas (hoy es
SQL/API directo — funcional, pero manual).

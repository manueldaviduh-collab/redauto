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
  transacción) con contraseña hasheada (bcrypt) y sesión con JWT.
- Login.
- Alta y edición de productos, siempre resolviendo la tienda dueña desde el
  token — nunca desde lo que mande el cliente, para que un vendedor no
  pueda publicar en la tienda de otro.
- Lectura pública de tiendas y productos (para que la navegación de compra
  del frontend los muestre).

Todavía no hace (ver `docs/ROADMAP.md` para el orden en que se agrega):
carrito/pedidos reales, pagos, envíos, verificación real de tiendas (KYC),
subida de imágenes, reseñas, notificaciones push. El frontend sigue
resolviendo esas partes en `localStorage`, documentado en el README raíz.

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

## Cómo cargar tu propia tienda (sin pasos de demostración)

Una vez que el backend esté corriendo (local o desplegado) y el frontend
apunte a él:

1. Abre la app → **Crear cuenta**.
2. Completa tus datos reales, marca **"Quiero vender en RedAuto (registrar
   mi tienda)"** y escribe el nombre real de tu tienda.
3. Al confirmar, quedas autenticado como vendedor de esa tienda (ya creada
   en la base de datos) y la app te lleva directo al **Panel de vendedor →
   Inventario**.
4. Ahí, **Agregar producto** por cada repuesto real que quieras publicar.

No hace falta ninguna consola de base de datos ni script aparte — es el
mismo flujo que usará cualquier tienda real que se registre después.

## Referencia rápida de endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| GET | `/api/health` | — | Chequeo de vida |
| POST | `/api/auth/register` | — | `{name,email,password,phone?,city?,storeName?}` → cuenta (+tienda si hay `storeName`) |
| POST | `/api/auth/login` | — | `{email,password}` → `{token,user,store}` |
| GET | `/api/auth/me` | Bearer | Cuenta + tienda de la sesión actual |
| GET | `/api/products` | — | Catálogo público; filtros `?categoryId=&storeId=&availability=&type=&query=` |
| GET | `/api/products/:id` | — | Un producto |
| GET | `/api/products/mine/list` | Bearer (vendedor) | Inventario completo de tu tienda |
| POST | `/api/products` | Bearer (vendedor) | Crear producto en tu tienda |
| PATCH | `/api/products/:id` | Bearer (vendedor) | Editar un producto tuyo |
| GET | `/api/stores` | — | Tiendas verificadas |
| GET | `/api/stores/:id` | — | Una tienda + su catálogo resumido |

## Seguridad — qué ya está y qué falta antes de manejar datos sensibles reales

Ya está: contraseñas con hash (nunca en texto plano), sesión firmada (JWT),
cada escritura de producto verificada contra el dueño real de la tienda
(nunca confía en un `storeId` que mande el cliente).

Falta antes de un uso con más volumen/sensibilidad (ver
`docs/ARQUITECTURA.md` §8 y `docs/ROADMAP.md`): límite de intentos de
login (rate limiting), rotación/expiración más corta de tokens si hace
falta, verificación real de tienda (hoy toda tienda que se registra queda
"verificada" automáticamente — es una simplificación deliberada del piloto,
no un descuido).

-- Esquema real de RedAuto. Ver docs/BASE_DE_DATOS.md para el detalle
-- completo (qué está implementado vs. objetivo) y el porqué de cada
-- decisión. Este script es idempotente a propósito (CREATE TABLE/INDEX ...
-- IF NOT EXISTS, ALTER ... ADD COLUMN IF NOT EXISTS): correrlo de nuevo
-- sobre una base ya migrada es seguro, solo aplica lo que falte — así es
-- como se aplican los cambios en Railway (pegar este archivo completo en
-- la consola de Postgres).
--
-- IMPORTANTE: este script no inserta ninguna tienda, usuario ni producto de
-- muestra. La única data que siembra son las categorías, que son taxonomía
-- estructural de la app (no un negocio ficticio) — el mismo listado que ya
-- vive en js/data/categories.js.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  city          TEXT,
  -- 'admin' se agregó para el flujo de aprobación de tiendas (ver
  -- docs/ROADMAP.md, Etapa 2) — nadie tiene este rol por defecto, se
  -- asigna a mano con UPDATE (ver server/README.md, "Aprobar una tienda").
  role          TEXT NOT NULL DEFAULT 'comprador' CHECK (role IN ('comprador', 'vendedor', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
-- Relaja el CHECK de una base ya migrada con el esquema anterior (que solo
-- permitía 'comprador'/'vendedor') para que acepte 'admin' también.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('comprador', 'vendedor', 'admin'));

CREATE TABLE IF NOT EXISTS categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  rif                  TEXT,
  responsible_name     TEXT,
  city                 TEXT,
  state                TEXT,
  address              TEXT,
  phone                TEXT,
  whatsapp             TEXT,
  logo_url             TEXT,
  about                TEXT,
  -- Toda tienda que se autorregistra queda pendiente hasta que el fundador
  -- (o un admin) la apruebe a mano — ya no se auto-verifica (ver
  -- docs/ROADMAP.md, Etapa 2). Mientras está 'pendiente' o 'rechazada',
  -- GET /api/stores no la incluye — no se publica sola.
  verification_status  TEXT NOT NULL DEFAULT 'pendiente' CHECK (verification_status IN ('pendiente', 'verificada', 'rechazada')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un usuario vendedor = una tienda, por ahora (simplificación consciente:
-- un mismo dueño con varias tiendas es un caso futuro, no del piloto).
CREATE UNIQUE INDEX IF NOT EXISTS stores_owner_user_id_idx ON stores (owner_user_id);
-- Defensivo para una base ya migrada con el esquema anterior (sin estas
-- columnas todavía) — en una instalación nueva ya vienen en el CREATE TABLE
-- de arriba, así que estos ALTER quedan como no-op.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS rif TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url TEXT;
-- Corrige el default de una base ya migrada con el esquema anterior (que
-- auto-verificaba). El código de /auth/register ya fija 'pendiente'
-- explícitamente en el INSERT — esto es defensa adicional, no la única
-- barrera.
ALTER TABLE stores ALTER COLUMN verification_status SET DEFAULT 'pendiente';

-- Categorías que la tienda declara vender al registrarse — no depende de
-- que ya tenga productos cargados (a diferencia de stores.js/withExtras,
-- que hoy calcula categorías a partir del catálogo real; esta tabla es la
-- fuente principal, con ese cálculo como respaldo si está vacía).
CREATE TABLE IF NOT EXISTS store_categories (
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES categories(id),
  PRIMARY KEY (store_id, category_id)
);

CREATE TABLE IF NOT EXISTS products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id           TEXT NOT NULL REFERENCES categories(id),
  name                  TEXT NOT NULL,
  part_brand            TEXT,
  sku                   TEXT,
  type                  TEXT NOT NULL DEFAULT 'alternativo' CHECK (type IN ('original', 'alternativo')),
  description           TEXT,
  price_cents           INTEGER NOT NULL CHECK (price_cents >= 0),
  original_price_cents  INTEGER CHECK (original_price_cents IS NULL OR original_price_cents >= price_cents),
  stock                 INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  availability          TEXT NOT NULL DEFAULT 'en_stock' CHECK (availability IN ('en_stock', 'bajo_pedido', 'agotado')),
  -- Ubicación interna en el almacén de la tienda (pasillo, estante, etc.)
  -- — uso exclusivo del vendedor, nunca se muestra al comprador.
  internal_location     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_store_id_idx ON products (store_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_location TEXT;
-- Permite que la importación masiva por Excel sea idempotente: volver a
-- subir la misma plantilla (con precios/stock corregidos) actualiza el
-- producto existente por SKU en vez de duplicarlo. Parcial porque el alta
-- individual de producto no siempre tiene SKU.
CREATE UNIQUE INDEX IF NOT EXISTS products_store_sku_idx ON products (store_id, sku) WHERE sku IS NOT NULL;

-- Compatibilidad real de vehículos: un producto puede tener varias filas
-- (uno por cada vehículo compatible). Marca/modelo son texto libre, no FK a
-- un catálogo cerrado — el objetivo es que cualquier tienda pueda declarar
-- compatibilidad sin depender de que RedAuto tenga precargada su marca
-- exacta (ver docs/BASE_DE_DATOS.md para el catálogo cerrado como
-- evolución futura, si hace falta).
CREATE TABLE IF NOT EXISTS product_compatibility (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vehicle_brand  TEXT NOT NULL,
  vehicle_model  TEXT NOT NULL,
  year_from      INTEGER,
  year_to        INTEGER,
  engine         TEXT,
  vehicle_trim   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_compatibility_product_id_idx ON product_compatibility (product_id);
-- La consulta más caliente cuando exista búsqueda por vehículo del lado del
-- comprador: "qué productos sirven para esta marca/modelo".
CREATE INDEX IF NOT EXISTS product_compatibility_vehicle_idx ON product_compatibility (vehicle_brand, vehicle_model);

-- Fotos reales de producto. Vacía hasta que se conecte un proveedor de
-- almacenamiento de imágenes (ver docs/ARQUITECTURA.md §9) — la tabla ya
-- queda lista para que el endpoint de subida solo tenga que insertar filas
-- acá, sin tocar el esquema de nuevo. `position` es el orden de la galería;
-- position 0 es la foto principal.
CREATE TABLE IF NOT EXISTS product_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON product_images (product_id);

-- Taxonomía real (idéntica a js/data/categories.js) — no es data de demo,
-- es la estructura de categorías que la app necesita para funcionar.
INSERT INTO categories (id, name, icon) VALUES
  ('motor', 'Motor', 'cog'),
  ('frenos', 'Frenos', 'disc'),
  ('suspension', 'Suspensión', 'activity'),
  ('baterias', 'Baterías', 'batteryCharging'),
  ('aceites', 'Aceites y Lubricantes', 'droplet'),
  ('filtros', 'Filtros', 'filter'),
  ('iluminacion', 'Iluminación', 'lightbulb'),
  ('cauchos', 'Cauchos', 'circleDot')
ON CONFLICT (id) DO NOTHING;

-- Esquema real de RedAuto (Etapa 1 del roadmap: backend mínimo para que una
-- tienda real pueda registrarse y publicar productos). Ver
-- docs/BASE_DE_DATOS.md para el esquema objetivo completo — este archivo
-- implementa el subconjunto necesario para autenticación + alta de
-- productos, sin más.
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
  role          TEXT NOT NULL DEFAULT 'comprador' CHECK (role IN ('comprador', 'vendedor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  city                 TEXT,
  address              TEXT,
  phone                TEXT,
  about                TEXT,
  -- En este MVP toda tienda que se auto-registra queda verificada de una
  -- vez (no hay flujo de KYC real todavía — ver docs/ROADMAP.md, Etapa 2).
  -- Se declara así explícitamente, no se finge un proceso que no existe.
  verification_status  TEXT NOT NULL DEFAULT 'verificada' CHECK (verification_status IN ('pendiente', 'verificada', 'rechazada')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un usuario vendedor = una tienda, por ahora (simplificación consciente:
-- un mismo dueño con varias tiendas es un caso futuro, no del piloto).
CREATE UNIQUE INDEX IF NOT EXISTS stores_owner_user_id_idx ON stores (owner_user_id);

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
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_store_id_idx ON products (store_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);

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

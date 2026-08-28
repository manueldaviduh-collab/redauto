import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const productsRouter = Router();

const toCents = (value) => Math.round(Number(value) * 100);
const toDollars = (cents) => (cents == null ? null : Number(cents) / 100);

// Misma forma que ya consume el frontend (ver js/services/productService.js
// y js/data/products.js) para que components.js/screens/*.js no necesiten
// saber si un producto vino del catálogo local o del backend real.
function toProductViewModel(row) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    partBrand: row.part_brand || '',
    type: row.type,
    price: toDollars(row.price_cents),
    originalPrice: toDollars(row.original_price_cents),
    availability: row.availability,
    stock: row.stock,
    storeId: row.store_id,
    // Sin reseñas reales todavía (ver docs/ROADMAP.md, Etapa 2) — se
    // muestra en 0, nunca un número inventado.
    rating: row.rating != null ? Number(row.rating) : 0,
    reviewsCount: row.reviews_count ?? 0,
    sku: row.sku || '',
    description: row.description || '',
    // El formulario de alta de productos del panel de vendedor todavía no
    // recoge compatibilidad por vehículo (ver js/screens/seller.js) — se
    // declara Universal por defecto, igual que ya hacía sellerService en
    // localStorage. Cuando el formulario la pida, este default deja de
    // aplicarse.
    compatibility: [{ brand: 'Universal', model: 'Todas', yearFrom: 2000, yearTo: 2026 }],
  };
}

async function getOwnStoreId(userId) {
  const result = await pool.query('SELECT id FROM stores WHERE owner_user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

// GET /api/products — catálogo público real (todas las tiendas reales).
// Soporta los mismos filtros que productService.search() ya usa.
productsRouter.get('/', asyncHandler(async (req, res) => {
  const { categoryId, storeId, availability, type, query: q } = req.query;
  const clauses = [];
  const params = [];

  if (categoryId) { params.push(categoryId); clauses.push(`category_id = $${params.length}`); }
  if (storeId) { params.push(storeId); clauses.push(`store_id = $${params.length}`); }
  if (availability) { params.push(availability); clauses.push(`availability = $${params.length}`); }
  if (type) { params.push(type); clauses.push(`type = $${params.length}`); }
  if (q) { params.push(`%${q}%`); clauses.push(`(name ILIKE $${params.length} OR part_brand ILIKE $${params.length})`); }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM products ${where} ORDER BY created_at DESC`, params);
  res.json(result.rows.map(toProductViewModel));
}));

productsRouter.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(toProductViewModel(result.rows[0]));
}));

// GET /api/products/mine/list — inventario completo de la tienda del
// vendedor autenticado (incluye agotados, a diferencia del listado público
// que igual los incluye pero esto deja claro el propósito: "mi inventario").
productsRouter.get('/mine/list', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const storeId = await getOwnStoreId(req.auth.id);
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });
  const result = await pool.query('SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC', [storeId]);
  res.json(result.rows.map(toProductViewModel));
}));

function validateProductInput(body) {
  const { name, categoryId, price } = body;
  if (!name || String(name).trim().length < 2) return 'Ingresa el nombre del producto.';
  if (!categoryId) return 'Selecciona una categoría.';
  if (price == null || Number.isNaN(Number(price)) || Number(price) < 0) return 'Ingresa un precio válido.';
  return null;
}

// POST /api/products — alta de producto real para la tienda del vendedor
// autenticado. storeId nunca se toma del body: siempre se resuelve del
// token, para que un vendedor no pueda publicar en la tienda de otro.
productsRouter.post('/', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const error = validateProductInput(req.body || {});
  if (error) return res.status(400).json({ error });

  const storeId = await getOwnStoreId(req.auth.id);
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });

  const {
    name, categoryId, partBrand, type, price, originalPrice, stock, availability, description, sku,
  } = req.body;

  const result = await pool.query(
    `INSERT INTO products
       (store_id, category_id, name, part_brand, sku, type, description, price_cents, original_price_cents, stock, availability)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      storeId, categoryId, String(name).trim(), partBrand || null, sku || null,
      type === 'original' ? 'original' : 'alternativo', description || null,
      toCents(price), originalPrice != null && originalPrice !== '' ? toCents(originalPrice) : null,
      Number(stock) || 0, ['en_stock', 'bajo_pedido', 'agotado'].includes(availability) ? availability : 'en_stock',
    ]
  );
  res.status(201).json(toProductViewModel(result.rows[0]));
}));

// PATCH /api/products/:id — edición, sólo si el producto es de la tienda
// del vendedor autenticado (verificado con un WHERE, no confiando en el
// cliente).
productsRouter.patch('/:id', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const storeId = await getOwnStoreId(req.auth.id);
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });

  const owns = await pool.query('SELECT id FROM products WHERE id = $1 AND store_id = $2', [req.params.id, storeId]);
  if (!owns.rowCount) return res.status(404).json({ error: 'Producto no encontrado en tu tienda.' });

  const {
    name, categoryId, partBrand, type, price, originalPrice, stock, availability, description, sku,
  } = req.body || {};

  const result = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       category_id = COALESCE($2, category_id),
       part_brand = COALESCE($3, part_brand),
       sku = COALESCE($4, sku),
       type = COALESCE($5, type),
       description = COALESCE($6, description),
       price_cents = COALESCE($7, price_cents),
       original_price_cents = COALESCE($8, original_price_cents),
       stock = COALESCE($9, stock),
       availability = COALESCE($10, availability),
       updated_at = now()
     WHERE id = $11 RETURNING *`,
    [
      name ? String(name).trim() : null, categoryId || null, partBrand ?? null, sku ?? null,
      type === 'original' || type === 'alternativo' ? type : null, description ?? null,
      price != null && price !== '' ? toCents(price) : null,
      originalPrice != null && originalPrice !== '' ? toCents(originalPrice) : null,
      stock != null && stock !== '' ? Number(stock) : null,
      ['en_stock', 'bajo_pedido', 'agotado'].includes(availability) ? availability : null,
      req.params.id,
    ]
  );
  res.json(toProductViewModel(result.rows[0]));
}));

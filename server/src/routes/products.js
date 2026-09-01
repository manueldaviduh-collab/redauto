import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { isImageStorageConfigured, uploadImageBuffer, deleteImage } from '../services/imageStorage.js';

export const productsRouter = Router();

const MAX_PRODUCT_IMAGES = 8;

// En memoria, nunca a disco (mismo criterio que la importación por Excel) —
// el filesystem del contenedor no es persistente entre despliegues.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const toCents = (value) => Math.round(Number(value) * 100);
const toDollars = (cents) => (cents == null ? null : Number(cents) / 100);

// Misma forma que ya consume el frontend (ver js/services/productService.js
// y js/data/products.js) para que components.js/screens/*.js no necesiten
// saber si un producto vino del catálogo local o del backend real.
function toProductViewModel(row, { compatibility = [], images = [] } = {}) {
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
    internalLocation: row.internal_location || '',
    // Compatibilidad real desde product_compatibility. Un producto viejo
    // creado antes de que esto existiera, sin ninguna fila cargada, cae al
    // "Universal" de siempre para no dejar la ficha vacía.
    compatibility: compatibility.length ? compatibility : [{ brand: 'Universal', model: 'Todas', yearFrom: 2000, yearTo: 2026 }],
    // Vacío hasta que se conecte almacenamiento de imágenes real (ver
    // docs/ARQUITECTURA.md §9) — la ilustración por categoría sigue siendo
    // el fallback en el frontend mientras esto esté vacío.
    images,
  };
}

function toCompatibilityViewModel(row) {
  return {
    brand: row.vehicle_brand,
    model: row.vehicle_model,
    yearFrom: row.year_from,
    yearTo: row.year_to,
    engine: row.engine || undefined,
    trim: row.vehicle_trim || undefined,
  };
}

async function withExtras(row) {
  const [compat, images] = await Promise.all([
    pool.query(
      'SELECT vehicle_brand, vehicle_model, year_from, year_to, engine, vehicle_trim FROM product_compatibility WHERE product_id = $1 ORDER BY created_at',
      [row.id]
    ),
    pool.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY position', [row.id]),
  ]);
  return toProductViewModel(row, {
    compatibility: compat.rows.map(toCompatibilityViewModel),
    images: images.rows.map((r) => r.url),
  });
}

async function getOwnStoreId(userId) {
  const result = await pool.query('SELECT id FROM stores WHERE owner_user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

// Resuelve un producto sólo si es dueño de él el vendedor autenticado —
// mismo patrón que el resto de las rutas de escritura: nunca confiar en el
// :id de la URL sin cruzarlo contra la tienda del token.
async function getOwnProduct(userId, productId) {
  const storeId = await getOwnStoreId(userId);
  if (!storeId) return null;
  const result = await pool.query('SELECT id FROM products WHERE id = $1 AND store_id = $2', [productId, storeId]);
  return result.rows[0] ? { id: productId, storeId } : null;
}

async function listProductImages(productId) {
  const result = await pool.query(
    'SELECT id, url, position FROM product_images WHERE product_id = $1 ORDER BY position',
    [productId]
  );
  return result.rows;
}

function validateCompatibilityInput(list) {
  if (!Array.isArray(list) || !list.length) {
    return 'Agrega al menos un vehículo compatible.';
  }
  for (const c of list) {
    if (!c || !String(c.brand || '').trim() || !String(c.model || '').trim()) {
      return 'Cada vehículo compatible necesita al menos marca y modelo.';
    }
  }
  return null;
}

async function replaceCompatibility(client, productId, list) {
  await client.query('DELETE FROM product_compatibility WHERE product_id = $1', [productId]);
  for (const c of list) {
    await client.query(
      `INSERT INTO product_compatibility (product_id, vehicle_brand, vehicle_model, year_from, year_to, engine, vehicle_trim)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        productId, String(c.brand).trim(), String(c.model).trim(),
        c.yearFrom ? Number(c.yearFrom) : null, c.yearTo ? Number(c.yearTo) : null,
        c.engine ? String(c.engine).trim() : null, c.trim ? String(c.trim).trim() : null,
      ]
    );
  }
}

// GET /api/products — catálogo público real. Solo productos de tiendas ya
// verificadas: una tienda pendiente o rechazada no se publica sola, ni
// siquiera vía este listado (el mismo filtro que ya aplica GET
// /api/stores). Soporta los mismos filtros que productService.search() ya
// usa.
productsRouter.get('/', asyncHandler(async (req, res) => {
  const { categoryId, storeId, availability, type, query: q } = req.query;
  const clauses = [`s.verification_status = 'verificada'`];
  const params = [];

  if (categoryId) { params.push(categoryId); clauses.push(`p.category_id = $${params.length}`); }
  if (storeId) { params.push(storeId); clauses.push(`p.store_id = $${params.length}`); }
  if (availability) { params.push(availability); clauses.push(`p.availability = $${params.length}`); }
  if (type) { params.push(type); clauses.push(`p.type = $${params.length}`); }
  if (q) { params.push(`%${q}%`); clauses.push(`(p.name ILIKE $${params.length} OR p.part_brand ILIKE $${params.length})`); }

  const result = await pool.query(
    `SELECT p.* FROM products p JOIN stores s ON s.id = p.store_id
     WHERE ${clauses.join(' AND ')} ORDER BY p.created_at DESC`,
    params
  );
  res.json(await Promise.all(result.rows.map(withExtras)));
}));

productsRouter.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT p.* FROM products p JOIN stores s ON s.id = p.store_id
     WHERE p.id = $1 AND s.verification_status = 'verificada'`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(await withExtras(result.rows[0]));
}));

// GET /api/products/mine/list — inventario completo de la tienda del
// vendedor autenticado (incluye agotados, a diferencia del listado público
// que igual los incluye pero esto deja claro el propósito: "mi inventario").
productsRouter.get('/mine/list', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const storeId = await getOwnStoreId(req.auth.id);
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });
  const result = await pool.query('SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC', [storeId]);
  res.json(await Promise.all(result.rows.map(withExtras)));
}));

function validateProductInput(body) {
  const { name, categoryId, price } = body;
  if (!name || String(name).trim().length < 2) return 'Ingresa el nombre del producto.';
  if (!categoryId) return 'Selecciona una categoría.';
  if (price == null || Number.isNaN(Number(price)) || Number(price) < 0) return 'Ingresa un precio válido.';
  return validateCompatibilityInput(body.compatibility);
}

// POST /api/products — alta de producto real para la tienda del vendedor
// autenticado. storeId nunca se toma del body: siempre se resuelve del
// token, para que un vendedor no pueda publicar en la tienda de otro. La
// compatibilidad es obligatoria (al menos un vehículo) y se guarda en la
// misma transacción que el producto.
productsRouter.post('/', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const error = validateProductInput(req.body || {});
  if (error) return res.status(400).json({ error });

  const storeId = await getOwnStoreId(req.auth.id);
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });

  const {
    name, categoryId, partBrand, type, price, originalPrice, stock, availability, description, sku,
    internalLocation, compatibility,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO products
         (store_id, category_id, name, part_brand, sku, type, description, price_cents, original_price_cents, stock, availability, internal_location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        storeId, categoryId, String(name).trim(), partBrand || null, sku || null,
        type === 'original' ? 'original' : 'alternativo', description || null,
        toCents(price), originalPrice != null && originalPrice !== '' ? toCents(originalPrice) : null,
        Number(stock) || 0, ['en_stock', 'bajo_pedido', 'agotado'].includes(availability) ? availability : 'en_stock',
        internalLocation || null,
      ]
    );
    const product = result.rows[0];
    await replaceCompatibility(client, product.id, compatibility);
    await client.query('COMMIT');
    res.status(201).json(await withExtras(product));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// PATCH /api/products/:id — edición, sólo si el producto es de la tienda
// del vendedor autenticado (verificado con un WHERE, no confiando en el
// cliente). Si viene `compatibility`, reemplaza la lista completa (no la
// mezcla con la anterior) — así "quitar un vehículo" es simplemente no
// mandarlo en el array.
productsRouter.patch('/:id', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const storeId = await getOwnStoreId(req.auth.id);
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });

  const owns = await pool.query('SELECT id FROM products WHERE id = $1 AND store_id = $2', [req.params.id, storeId]);
  if (!owns.rowCount) return res.status(404).json({ error: 'Producto no encontrado en tu tienda.' });

  if (req.body?.compatibility !== undefined) {
    const compatError = validateCompatibilityInput(req.body.compatibility);
    if (compatError) return res.status(400).json({ error: compatError });
  }

  const {
    name, categoryId, partBrand, type, price, originalPrice, stock, availability, description, sku,
    internalLocation, compatibility,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
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
         internal_location = COALESCE($11, internal_location),
         updated_at = now()
       WHERE id = $12 RETURNING *`,
      [
        name ? String(name).trim() : null, categoryId || null, partBrand ?? null, sku ?? null,
        type === 'original' || type === 'alternativo' ? type : null, description ?? null,
        price != null && price !== '' ? toCents(price) : null,
        originalPrice != null && originalPrice !== '' ? toCents(originalPrice) : null,
        stock != null && stock !== '' ? Number(stock) : null,
        ['en_stock', 'bajo_pedido', 'agotado'].includes(availability) ? availability : null,
        internalLocation ?? null,
        req.params.id,
      ]
    );
    if (compatibility !== undefined) {
      await replaceCompatibility(client, req.params.id, compatibility);
    }
    await client.query('COMMIT');
    res.json(await withExtras(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// GET /api/products/:id/images — galería con id (no sólo la URL) para que
// el panel de vendedor pueda borrar/reordenar. La ficha pública sigue
// usando toProductViewModel().images (array de URLs), sin tocar esa forma.
productsRouter.get('/:id/images', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const owned = await getOwnProduct(req.auth.id, req.params.id);
  if (!owned) return res.status(404).json({ error: 'Producto no encontrado en tu tienda.' });
  res.json({ images: await listProductImages(req.params.id) });
}));

// POST /api/products/:id/images — sube una foto real a Cloudinary y la
// asocia al producto. multipart/form-data, campo "file" (mismo patrón que
// la importación por Excel: multer en memoria, nunca a disco).
productsRouter.post('/:id/images', requireAuth, requireSeller, imageUpload.single('file'), asyncHandler(async (req, res) => {
  if (!isImageStorageConfigured()) {
    return res.status(503).json({ error: 'La subida de fotos todavía no está configurada en el servidor.' });
  }
  const owned = await getOwnProduct(req.auth.id, req.params.id);
  if (!owned) return res.status(404).json({ error: 'Producto no encontrado en tu tienda.' });
  if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen.' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'El archivo debe ser una imagen.' });

  const existing = await listProductImages(req.params.id);
  if (existing.length >= MAX_PRODUCT_IMAGES) {
    return res.status(400).json({ error: `Máximo ${MAX_PRODUCT_IMAGES} fotos por producto.` });
  }

  const uploaded = await uploadImageBuffer(req.file.buffer, { folder: `redauto/products/${req.params.id}` });
  // MAX(position)+1, no COUNT: si se borró una foto de en medio antes, el
  // conteo y la posición máxima real ya no coinciden — usar el conteo acá
  // podría reasignar una posición que otra foto ya tiene.
  await pool.query(
    `INSERT INTO product_images (product_id, url, public_id, position)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM product_images WHERE product_id = $1), 0))`,
    [req.params.id, uploaded.url, uploaded.publicId]
  );
  res.status(201).json({ images: await listProductImages(req.params.id) });
}));

// DELETE /api/products/:id/images/:imageId — borra la fila y, si tiene
// public_id, también la imagen en Cloudinary (best-effort: si Cloudinary
// falla, igual queda borrada de la base, nunca al revés).
productsRouter.delete('/:id/images/:imageId', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const owned = await getOwnProduct(req.auth.id, req.params.id);
  if (!owned) return res.status(404).json({ error: 'Producto no encontrado en tu tienda.' });
  const found = await pool.query(
    'SELECT public_id FROM product_images WHERE id = $1 AND product_id = $2',
    [req.params.imageId, req.params.id]
  );
  if (!found.rowCount) return res.status(404).json({ error: 'Foto no encontrada.' });
  await pool.query('DELETE FROM product_images WHERE id = $1', [req.params.imageId]);
  if (found.rows[0].public_id) {
    deleteImage(found.rows[0].public_id).catch((err) => console.error('No se pudo borrar en Cloudinary:', err));
  }
  res.json({ images: await listProductImages(req.params.id) });
}));

// PATCH /api/products/:id/images/:imageId — reordena intercambiando la
// posición con la foto vecina ({ direction: 'up' | 'down' }). Alcanza para
// hasta 8 fotos (el máximo) sin necesitar drag-and-drop.
productsRouter.patch('/:id/images/:imageId', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const owned = await getOwnProduct(req.auth.id, req.params.id);
  if (!owned) return res.status(404).json({ error: 'Producto no encontrado en tu tienda.' });
  const direction = req.body?.direction;
  if (direction !== 'up' && direction !== 'down') return res.status(400).json({ error: 'Dirección inválida.' });

  const images = await listProductImages(req.params.id);
  const idx = images.findIndex((img) => img.id === req.params.imageId);
  if (idx === -1) return res.status(404).json({ error: 'Foto no encontrada.' });
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= images.length) return res.json({ images });

  const a = images[idx];
  const b = images[swapWith];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE product_images SET position = $1 WHERE id = $2', [b.position, a.id]);
    await client.query('UPDATE product_images SET position = $1 WHERE id = $2', [a.position, b.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.json({ images: await listProductImages(req.params.id) });
}));

import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireAuth, requireSeller, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { isImageStorageConfigured, uploadImageBuffer, deleteImage } from '../services/imageStorage.js';

export const storesRouter = Router();

// En memoria, nunca a disco (mismo criterio que las fotos de producto) — un
// solo logo por tienda, no hace falta el límite de 8 de product_images.
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Misma forma que espera storeDetail.js/components.js (ver
// js/data/stores.js). Los campos que este MVP todavía no recoge en el
// registro (horario, WhatsApp, tiempo de respuesta, estadísticas) van con
// valores honestos por defecto — nunca un número inventado — y quedan
// listos para completarse cuando el panel de vendedor los pida (ver
// docs/ROADMAP.md, Etapa 2).
function toStoreViewModel(row, { productCount = 0, categories = [] } = {}) {
  return {
    id: row.id,
    name: row.name,
    rif: row.rif || '',
    responsibleName: row.responsible_name || '',
    city: row.city || '',
    state: row.state || '',
    address: row.address || '',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    logoUrl: row.logo_url || null,
    verified: row.verification_status === 'verificada',
    verification: { status: row.verification_status, since: row.created_at },
    rating: 0,
    reviewsCount: 0,
    yearsInRedAuto: 0,
    salesCount: 0,
    onTimeDeliveryPct: null,
    categories,
    delivery: { shipping: 'Coordina el envío directamente con la tienda.', pickup: false },
    deliveryOptions: [],
    hours: 'Aún no especificado',
    responseTime: 'Aún sin historial de respuesta',
    about: row.about || '',
    initials: (row.name || '')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase(),
    productCount,
  };
}

async function withExtras(row) {
  const [products, declared] = await Promise.all([
    pool.query('SELECT category_id FROM products WHERE store_id = $1', [row.id]),
    pool.query('SELECT category_id FROM store_categories WHERE store_id = $1', [row.id]),
  ]);
  // Las categorías declaradas al registrarse son la fuente principal (una
  // tienda recién aprobada, sin productos todavía, igual debe poder
  // mostrarlas); si no declaró ninguna, se calculan del catálogo real.
  const categories = declared.rowCount
    ? declared.rows.map((c) => c.category_id)
    : [...new Set(products.rows.map((p) => p.category_id))];
  return toStoreViewModel(row, { productCount: products.rowCount, categories });
}

// GET /api/stores — solo tiendas ya verificadas: una tienda pendiente o
// rechazada nunca se publica sola a compradores (ver auth.js /register).
storesRouter.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT * FROM stores WHERE verification_status = 'verificada' ORDER BY created_at DESC");
  res.json(await Promise.all(result.rows.map(withExtras)));
}));

// GET /api/stores/mine — la tienda del vendedor autenticado, sin importar
// su estado de verificación (a diferencia de GET /, que solo muestra
// verificadas). Así el panel de vendedor puede mostrar "Pendiente de
// verificación" mientras espera aprobación.
storesRouter.get('/mine', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM stores WHERE owner_user_id = $1', [req.auth.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });
  res.json(await withExtras(result.rows[0]));
}));

// PATCH /api/stores/mine — editar los datos de la propia tienda. Nunca
// permite cambiar verification_status desde acá (eso solo lo hace un
// admin, ver PATCH /:id/verification) ni owner_user_id.
storesRouter.patch('/mine', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const own = await pool.query('SELECT id FROM stores WHERE owner_user_id = $1', [req.auth.id]);
  if (!own.rows[0]) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });
  const storeId = own.rows[0].id;

  const {
    name, rif, responsibleName, city, state, address, phone, whatsapp, about, categoryIds,
  } = req.body || {};

  const result = await pool.query(
    `UPDATE stores SET
       name = COALESCE($1, name),
       rif = COALESCE($2, rif),
       responsible_name = COALESCE($3, responsible_name),
       city = COALESCE($4, city),
       state = COALESCE($5, state),
       address = COALESCE($6, address),
       phone = COALESCE($7, phone),
       whatsapp = COALESCE($8, whatsapp),
       about = COALESCE($9, about)
     WHERE id = $10 RETURNING *`,
    [
      name ? String(name).trim() : null, rif ?? null, responsibleName ?? null,
      city ?? null, state ?? null, address ?? null, phone ?? null, whatsapp ?? null,
      about ?? null, storeId,
    ]
  );

  if (Array.isArray(categoryIds)) {
    await pool.query('DELETE FROM store_categories WHERE store_id = $1', [storeId]);
    const ids = categoryIds.filter(Boolean);
    if (ids.length) {
      const validCategories = await pool.query('SELECT id FROM categories WHERE id = ANY($1)', [ids]);
      for (const row of validCategories.rows) {
        await pool.query('INSERT INTO store_categories (store_id, category_id) VALUES ($1, $2)', [storeId, row.id]);
      }
    }
  }

  res.json(await withExtras(result.rows[0]));
}));

// POST /api/stores/mine/logo — sube/reemplaza el logo real de la propia
// tienda. multipart/form-data, campo "file" (mismo patrón que las fotos de
// producto: multer en memoria, nunca a disco). Si ya había un logo, el
// anterior se borra de Cloudinary después de guardar el nuevo (best-effort:
// si ese borrado falla, igual queda el logo nuevo puesto, nunca al revés).
storesRouter.post('/mine/logo', requireAuth, requireSeller, logoUpload.single('file'), asyncHandler(async (req, res) => {
  if (!isImageStorageConfigured()) {
    return res.status(503).json({ error: 'La subida de logo todavía no está configurada en el servidor.' });
  }
  const own = await pool.query('SELECT id, logo_public_id FROM stores WHERE owner_user_id = $1', [req.auth.id]);
  const store = own.rows[0];
  if (!store) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });
  if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen.' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'El archivo debe ser una imagen.' });

  const uploaded = await uploadImageBuffer(req.file.buffer, { folder: `redauto/stores/${store.id}` });
  const result = await pool.query(
    'UPDATE stores SET logo_url = $1, logo_public_id = $2 WHERE id = $3 RETURNING *',
    [uploaded.url, uploaded.publicId, store.id]
  );
  if (store.logo_public_id) {
    deleteImage(store.logo_public_id).catch((err) => console.error('No se pudo borrar el logo anterior en Cloudinary:', err));
  }
  res.status(201).json(await withExtras(result.rows[0]));
}));

// DELETE /api/stores/mine/logo — quita el logo (la tienda vuelve a mostrar
// sus iniciales en la navegación).
storesRouter.delete('/mine/logo', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const own = await pool.query('SELECT id, logo_public_id FROM stores WHERE owner_user_id = $1', [req.auth.id]);
  const store = own.rows[0];
  if (!store) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });
  const result = await pool.query(
    'UPDATE stores SET logo_url = NULL, logo_public_id = NULL WHERE id = $1 RETURNING *',
    [store.id]
  );
  if (store.logo_public_id) {
    deleteImage(store.logo_public_id).catch((err) => console.error('No se pudo borrar el logo en Cloudinary:', err));
  }
  res.json(await withExtras(result.rows[0]));
}));

// GET /api/stores/admin — todas las tiendas sin importar su estado (a
// diferencia de GET /, que solo muestra verificadas), para el panel de
// administración. ?status=pendiente|verificada|rechazada filtra; sin el
// query param trae todas, pendientes primero (las que necesitan revisión).
storesRouter.get('/admin', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const clauses = [];
  const params = [];
  if (['pendiente', 'verificada', 'rechazada'].includes(status)) {
    params.push(status);
    clauses.push(`verification_status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM stores ${where}
     ORDER BY (verification_status = 'pendiente') DESC, created_at DESC`,
    params
  );
  res.json(await Promise.all(result.rows.map(withExtras)));
}));

// PATCH /api/stores/:id/verification — aprobar/rechazar una tienda
// pendiente. Solo un admin (ver server/README.md, "Aprobar una tienda", y
// el panel en js/screens/admin.js).
storesRouter.patch('/:id/verification', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!['verificada', 'rechazada', 'pendiente'].includes(status)) {
    return res.status(400).json({ error: "status debe ser 'verificada', 'rechazada' o 'pendiente'." });
  }
  const result = await pool.query(
    'UPDATE stores SET verification_status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Tienda no encontrada.' });
  res.json(await withExtras(result.rows[0]));
}));

// GET /api/stores/:id — pública sólo si la tienda ya está verificada (igual
// que GET /). Un admin autenticado (optionalAuth: no rechaza si no manda
// token) puede ver cualquiera, para revisarla antes de aprobar/rechazar
// desde el panel.
storesRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM stores WHERE id = $1', [req.params.id]);
  const store = result.rows[0];
  const isAdmin = req.auth?.role === 'admin';
  if (!store || (store.verification_status !== 'verificada' && !isAdmin)) {
    return res.status(404).json({ error: 'Tienda no encontrada.' });
  }
  res.json(await withExtras(store));
}));

import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const storesRouter = Router();

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
    city: row.city || '',
    address: row.address || '',
    phone: row.phone || '',
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
  const products = await pool.query('SELECT category_id FROM products WHERE store_id = $1', [row.id]);
  const categories = [...new Set(products.rows.map((p) => p.category_id))];
  return toStoreViewModel(row, { productCount: products.rowCount, categories });
}

storesRouter.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT * FROM stores WHERE verification_status = 'verificada' ORDER BY created_at DESC");
  res.json(await Promise.all(result.rows.map(withExtras)));
}));

storesRouter.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM stores WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Tienda no encontrada.' });
  res.json(await withExtras(result.rows[0]));
}));

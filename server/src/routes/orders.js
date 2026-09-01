import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const ordersRouter = Router();

const toDollars = (cents) => Number(cents) / 100;
const toDateStr = (d) => new Date(d).toISOString().slice(0, 10);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Misma forma que ya consumían js/screens/profile.js y js/screens/seller.js
// cuando los pedidos vivían en localStorage (ver js/services/orderService.js)
// — así ninguna pantalla necesitó cambiar para pasar a datos reales.
function toOrderViewModel(order, items) {
  return {
    id: order.id,
    date: toDateStr(order.created_at),
    status: order.status,
    total: toDollars(items.reduce((sum, i) => sum + i.unit_price_cents * i.qty, 0)),
    shippingInfo: {
      name: order.shipping_name || '',
      phone: order.shipping_phone || '',
      address: order.shipping_address || '',
      city: order.shipping_city || '',
    },
    items: items.map((i) => ({
      productId: i.product_id,
      storeId: i.store_id,
      qty: i.qty,
      price: toDollars(i.unit_price_cents),
      // Nombre congelado al momento de la compra, no el nombre actual del
      // producto (que puede haber cambiado o el producto puede haber sido
      // borrado — product_id queda NULL en ese caso, el nombre sobrevive).
      product: { id: i.product_id, name: i.product_name_snapshot },
    })),
  };
}

async function itemsForOrder(orderId) {
  const result = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at', [orderId]);
  return result.rows;
}

// POST /api/orders — crea un pedido real a partir del carrito. Precio y
// nombre se resuelven siempre del lado del servidor, nunca de lo que mande
// el cliente (mismo criterio que el resto de la API con dinero). Sólo
// acepta productos reales de tiendas ya verificadas — el catálogo de
// muestra (js/data/products.js) no existe en esta base, así que un intento
// de comprarlo simplemente no encuentra el producto y se descarta esa
// línea (ver `skippedCount` en la respuesta).
ordersRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { items, shipping } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'El carrito está vacío.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resolvedItems = [];
    let skippedCount = 0;
    for (const entry of items) {
      const qty = Number(entry?.qty) || 0;
      if (qty <= 0) continue;
      // Los ids del catálogo de muestra (js/data/products.js, ej. "p1") no
      // son UUID — nunca van a existir en products.id, pero pasárselos tal
      // cual a Postgres tira un error de tipo en vez de "no encontrado".
      // Se descartan acá mismo, antes de tocar la base.
      if (!UUID_RE.test(String(entry?.productId))) { skippedCount += 1; continue; }
      const result = await client.query(
        `SELECT p.id, p.name, p.price_cents, p.store_id
         FROM products p JOIN stores s ON s.id = p.store_id
         WHERE p.id = $1 AND s.verification_status = 'verificada'`,
        [entry.productId]
      );
      if (!result.rows[0]) { skippedCount += 1; continue; }
      resolvedItems.push({ ...result.rows[0], qty });
    }
    if (!resolvedItems.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ninguno de los productos del carrito está disponible para compra real.' });
    }

    const totalCents = resolvedItems.reduce((sum, i) => sum + i.price_cents * i.qty, 0);
    const { name, phone, address, city } = shipping || {};
    const orderResult = await client.query(
      `INSERT INTO orders (buyer_user_id, shipping_name, shipping_phone, shipping_address, shipping_city, total_cents)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.auth.id, name || null, phone || null, address || null, city || null, totalCents]
    );
    const order = orderResult.rows[0];

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, store_id, product_id, product_name_snapshot, unit_price_cents, qty)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, item.store_id, item.id, item.name, item.price_cents, item.qty]
      );
    }
    await client.query('COMMIT');

    res.status(201).json({ order: toOrderViewModel(order, await itemsForOrder(order.id)), skippedCount });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// GET /api/orders/mine — historial real del comprador autenticado, visible
// desde cualquier dispositivo (antes vivía en localStorage, por navegador).
ordersRouter.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const orders = await pool.query('SELECT * FROM orders WHERE buyer_user_id = $1 ORDER BY created_at DESC', [req.auth.id]);
  const withItems = await Promise.all(orders.rows.map(async (o) => toOrderViewModel(o, await itemsForOrder(o.id))));
  res.json(withItems);
}));

// GET /api/orders/store — pedidos que incluyen al menos un producto de la
// tienda del vendedor autenticado. El total mostrado es sólo el de SUS
// líneas, no el del pedido completo (un carrito puede mezclar tiendas —
// ver docs/BASE_DE_DATOS.md §5).
ordersRouter.get('/store', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const storeResult = await pool.query('SELECT id FROM stores WHERE owner_user_id = $1', [req.auth.id]);
  const storeId = storeResult.rows[0]?.id;
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });

  const itemsResult = await pool.query(
    `SELECT oi.*, o.status, o.created_at, o.shipping_name, o.shipping_phone, o.shipping_address, o.shipping_city
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.store_id = $1 ORDER BY o.created_at DESC`,
    [storeId]
  );
  const byOrder = new Map();
  for (const row of itemsResult.rows) {
    if (!byOrder.has(row.order_id)) {
      byOrder.set(row.order_id, {
        order: {
          id: row.order_id,
          status: row.status,
          created_at: row.created_at,
          shipping_name: row.shipping_name,
          shipping_phone: row.shipping_phone,
          shipping_address: row.shipping_address,
          shipping_city: row.shipping_city,
        },
        items: [],
      });
    }
    byOrder.get(row.order_id).items.push(row);
  }
  res.json([...byOrder.values()].map(({ order, items }) => toOrderViewModel(order, items)));
}));

// PATCH /api/orders/:id/status — el vendedor confirma que cobró (o
// cancela). El estado hoy es del pedido completo, no por tienda (ver
// docs/BASE_DE_DATOS.md §5) — cualquier vendedor con al menos una línea en
// ese pedido puede cambiarlo; en el caso común (un pedido = una tienda) es
// exactamente correcto.
ordersRouter.patch('/:id/status', requireAuth, requireSeller, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!['pendiente_pago', 'pagado', 'cancelado'].includes(status)) {
    return res.status(400).json({ error: "status debe ser 'pendiente_pago', 'pagado' o 'cancelado'." });
  }
  const storeResult = await pool.query('SELECT id FROM stores WHERE owner_user_id = $1', [req.auth.id]);
  const storeId = storeResult.rows[0]?.id;
  if (!storeId) return res.status(404).json({ error: 'Tu cuenta de vendedor no tiene una tienda asociada.' });

  const owns = await pool.query('SELECT 1 FROM order_items WHERE order_id = $1 AND store_id = $2', [req.params.id, storeId]);
  if (!owns.rowCount) return res.status(404).json({ error: 'Pedido no encontrado en tu tienda.' });

  const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  res.json(toOrderViewModel(result.rows[0], await itemsForOrder(req.params.id)));
}));

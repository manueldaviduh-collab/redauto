import { demoOrders } from '../data/users.js';
import { getItem, setItem } from './storage.js';
import { productService } from './productService.js';
import { cartService } from './cartService.js';

// No hay pasarela de pago real conectada todavía: `checkout` crea un pedido
// en estado explícito de "pendiente de pago (MVP)" y lo persiste local.
// El contrato (checkout, getOrdersForUser, getOrdersForStore) es el que se
// llamaría contra POST /api/orders cuando exista backend + pagos + envíos.
const LOCAL_ORDERS_KEY = 'orders_local';

function delay(ms = 240) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function allOrders() {
  return [...demoOrders, ...getItem(LOCAL_ORDERS_KEY, [])];
}

async function enrichOrder(order) {
  const items = await Promise.all(
    order.items.map(async (i) => ({ ...i, product: await productService.getById(i.productId) }))
  );
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return { ...order, items, total };
}

export const orderService = {
  async getOrdersForUser(userId) {
    await delay();
    const orders = allOrders().filter((o) => o.userId === userId);
    return Promise.all(orders.map(enrichOrder));
  },

  async getOrdersForStore(storeId) {
    await delay();
    const enrichedOrders = await Promise.all(allOrders().map(enrichOrder));
    return enrichedOrders
      .map((order) => {
        const storeItems = order.items.filter((i) => i.product?.storeId === storeId);
        if (!storeItems.length) return null;
        const storeTotal = storeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
        return { ...order, items: storeItems, total: storeTotal };
      })
      .filter(Boolean);
  },

  // MVP: no procesa pago real. Crea el pedido en estado demo y vacía el
  // carrito. `shippingInfo` queda listo para conectarse a un servicio de
  // envíos (cálculo de tarifa, tracking) más adelante.
  async checkout(userId, shippingInfo) {
    await delay(400);
    const cartItems = await cartService.getItems();
    if (!cartItems.length) return { ok: false, error: 'El carrito está vacío.' };

    const order = {
      id: `ord-${Date.now()}`,
      userId,
      date: new Date().toISOString().slice(0, 10),
      status: 'Pendiente de pago (MVP)',
      shippingInfo,
      items: cartItems.map((i) => ({ productId: i.product.id, qty: i.qty, price: i.product.price })),
    };
    const local = getItem(LOCAL_ORDERS_KEY, []);
    setItem(LOCAL_ORDERS_KEY, [...local, order]);
    cartService.clear();
    return { ok: true, order: await enrichOrder(order) };
  },
};

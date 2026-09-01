import { api, ApiError } from './api.js';
import { cartService } from './cartService.js';

// Pedidos reales contra el backend (server/) — antes vivían en localStorage
// (por navegador, se perdían al cambiar de dispositivo y el panel de
// vendedor mostraba pedidos de ejemplo). El contrato de estas tres
// funciones no cambió: checkout()/getOrdersForUser()/getOrdersForStore()
// ya devuelven exactamente la misma forma de antes, así que
// checkout.js/profile.js/seller.js no necesitaron tocarse (ver
// docs/ARQUITECTURA.md §12).
export const orderService = {
  async getOrdersForUser() {
    try {
      return await api.get('/orders/mine', { auth: true });
    } catch {
      return [];
    }
  },

  // storeId ya no hace falta: el servidor resuelve la tienda del token, no
  // de lo que mande el cliente (mismo criterio que el resto de la API).
  // Se deja el parámetro para no tener que tocar el único llamador
  // (sellerService.getDashboard).
  async getOrdersForStore() {
    try {
      return await api.get('/orders/store', { auth: true });
    } catch {
      return [];
    }
  },

  // Sin pasarela de pago real todavía: el pedido queda "pendiente de pago"
  // y la tienda coordina el cobro y la entrega por fuera (ver
  // docs/ROADMAP.md, Etapa 0). Lo que sí es real es el registro del pedido
  // — persiste en la base de datos, visible desde cualquier dispositivo.
  async checkout(userId, shippingInfo) {
    const cartItems = await cartService.getItems();
    if (!cartItems.length) return { ok: false, error: 'El carrito está vacío.' };

    try {
      const { order, skippedCount } = await api.post(
        '/orders',
        {
          items: cartItems.map((i) => ({ productId: i.product.id, qty: i.qty })),
          shipping: shippingInfo,
        },
        { auth: true }
      );
      cartService.clear();
      if (skippedCount) {
        // Productos del catálogo de muestra (no reales) que no se pudieron
        // comprar — se avisa en vez de fingir que se compraron.
        return { ok: true, order, warning: `${skippedCount} producto(s) de muestra no se pudieron comprar (todavía no son reales).` };
      }
      return { ok: true, order };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'No se pudo completar la compra.' };
    }
  },
};

import { orderService } from './orderService.js';
import { api } from './api.js';

// Panel de vendedor: a diferencia de la navegación de compra (que degrada
// en silencio si el backend no responde), acá un fallo de conexión se deja
// propagar — un vendedor necesita saber si su inventario no cargó porque no
// tiene productos o porque el servidor no respondió (ver
// docs/PRINCIPIOS.md §4, Transparencia). js/screens/seller.js decide cómo
// mostrarlo.
export const sellerService = {
  async getDashboard(storeId) {
    // /stores/mine (no /stores/:id) porque muestra la tienda del vendedor
    // sin importar su estado de verificación — el panel tiene que poder
    // mostrar "pendiente" mientras un admin la revisa (ver
    // server/src/routes/stores.js).
    const [store, products, orders] = await Promise.all([
      api.get('/stores/mine', { auth: true }),
      api.get('/products/mine/list', { auth: true }),
      orderService.getOrdersForStore(storeId),
    ]);
    // "Ventas totales" cuenta sólo lo ya cobrado (status 'pagado') — sumar
    // pedidos todavía pendientes de pago inflaría el número con dinero que
    // ni siquiera se sabe si va a cobrarse (ver PRINCIPIOS.md §4).
    const totalSales = orders.filter((o) => o.status === 'pagado').reduce((sum, o) => sum + o.total, 0);
    const pendingOrders = orders.filter((o) => o.status === 'pendiente_pago').length;
    return {
      store,
      products,
      orders,
      kpis: {
        totalSales,
        ordersCount: orders.length,
        pendingOrders,
        productsCount: products.length,
        rating: store?.rating ?? 0,
      },
    };
  },

  async addProduct(storeId, productData) {
    return api.post('/products', productData, { auth: true });
  },

  async updateProduct(productId, patch) {
    return api.patch(`/products/${productId}`, patch, { auth: true });
  },

  async updateStore(patch) {
    return api.patch('/stores/mine', patch, { auth: true });
  },

  // Logo real de la tienda (Cloudinary detrás de la API, mismo mecanismo
  // que las fotos de producto). Devuelve la tienda completa actualizada.
  async uploadStoreLogo(file) {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload('/stores/mine/logo', formData, { auth: true });
  },

  async deleteStoreLogo() {
    return api.del('/stores/mine/logo', { auth: true });
  },

  // El vendedor confirma que cobró un pedido (transferencia/pago móvil
  // coordinado por fuera de la app) o lo cancela — no hay pasarela de pago
  // real conectada todavía (ver docs/ROADMAP.md).
  async updateOrderStatus(orderId, status) {
    return api.patch(`/orders/${orderId}/status`, { status }, { auth: true });
  },

  // Fotos reales de producto (Cloudinary detrás de la API — ver
  // server/src/services/imageStorage.js). Las cuatro llamadas devuelven
  // siempre la galería completa actualizada, así el llamador nunca tiene
  // que recalcular posiciones a mano.
  async getProductImages(productId) {
    const { images } = await api.get(`/products/${productId}/images`, { auth: true });
    return images;
  },

  async uploadProductImage(productId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const { images } = await api.upload(`/products/${productId}/images`, formData, { auth: true });
    return images;
  },

  async deleteProductImage(productId, imageId) {
    const { images } = await api.del(`/products/${productId}/images/${imageId}`, { auth: true });
    return images;
  },

  async reorderProductImage(productId, imageId, direction) {
    const { images } = await api.patch(`/products/${productId}/images/${imageId}`, { direction }, { auth: true });
    return images;
  },
};

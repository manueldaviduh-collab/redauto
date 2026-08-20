import { productService } from './productService.js';
import { orderService } from './orderService.js';
import { getStoreById } from '../data/stores.js';

// Agrega datos de negocio para el panel de vendedor a partir de los mismos
// servicios que usa el comprador (no hay una fuente de datos paralela). Deja
// el punto de entrada listo para un futuro dashboard servido por backend.
export const sellerService = {
  async getDashboard(storeId) {
    const [store, products, orders] = await Promise.all([
      getStoreById(storeId),
      productService.getByStore(storeId),
      orderService.getOrdersForStore(storeId),
    ]);
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const pendingOrders = orders.filter((o) =>
      ['Pendiente de pago (MVP)', 'Pendiente de pago', 'Procesando'].includes(o.status)
    ).length;
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
    return productService.addProduct({ ...productData, storeId });
  },

  async updateProduct(productId, patch) {
    return productService.updateProduct(productId, patch);
  },
};

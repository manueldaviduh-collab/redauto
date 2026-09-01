import { api } from './api.js';

// Panel de administración: aprobar/rechazar tiendas. Sólo responde algo si
// la cuenta logueada tiene rol 'admin' — el servidor lo vuelve a verificar
// en cada llamada (ver server/src/routes/stores.js), esto no es la única
// barrera, sólo la capa que decide qué mostrar en pantalla.
export const adminService = {
  async listStores(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return api.get(`/stores/admin${query}`, { auth: true });
  },

  async setStoreVerification(storeId, status) {
    return api.patch(`/stores/${storeId}/verification`, { status }, { auth: true });
  },
};

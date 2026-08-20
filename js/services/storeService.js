import { stores, getStoreById } from '../data/stores.js';

// RedAuto sólo lista tiendas verificadas: no existe una vía en la UI para
// mostrar comercios no verificados. Cuando exista backend, este servicio se
// convierte en llamadas a GET /api/stores (filtradas server-side por
// verification.status === 'verificada').
export const storeService = {
  async getAll() {
    return [...stores].sort((a, b) => b.rating - a.rating);
  },
  async getById(id) {
    return getStoreById(id);
  },
  async search(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [...stores];
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
  },
};

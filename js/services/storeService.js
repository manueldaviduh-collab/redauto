import { stores, getStoreById } from '../data/stores.js';
import { api } from './api.js';

// RedAuto sólo lista tiendas verificadas. El catálogo local
// (js/data/stores.js) sigue como muestra visual del diseño; las tiendas
// reales creadas vía registro (ver server/) se combinan con ese catálogo
// para que una tienda real, apenas se registra, aparezca en la misma
// navegación que ya existe — sin cambiar ninguna pantalla. Si el backend no
// está encendido/alcanzable, se degrada de forma silenciosa al catálogo
// local (lectura pública, no bloqueante).
async function fetchBackendStores() {
  try {
    return await api.get('/stores');
  } catch {
    return [];
  }
}

export const storeService = {
  async getAll() {
    const remote = await fetchBackendStores();
    return [...stores, ...remote].sort((a, b) => b.rating - a.rating);
  },
  async getById(id) {
    const local = getStoreById(id);
    if (local) return local;
    try {
      return await api.get(`/stores/${id}`);
    } catch {
      return null;
    }
  },
  async search(query) {
    const q = (query || '').trim().toLowerCase();
    const remote = await fetchBackendStores();
    const all = [...stores, ...remote];
    if (!q) return all;
    return all.filter(
      (s) => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
  },
};

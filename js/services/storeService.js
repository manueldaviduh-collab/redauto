import { api } from './api.js';

// Sólo tiendas reales y verificadas — sin catálogo de muestra mezclado (ver
// docs/DECISIONES.md). Si el backend no responde, la navegación se degrada
// a "sin resultados" en vez de mostrar negocios que no existen.
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
    return remote.sort((a, b) => b.rating - a.rating);
  },
  async getById(id) {
    try {
      // auth:true manda el token si hay uno logueado (no pasa nada si no lo
      // hay) — permite que un admin pueda previsualizar una tienda pendiente
      // desde el panel de administración, sin cambiar nada para nadie más.
      return await api.get(`/stores/${id}`, { auth: true });
    } catch {
      return null;
    }
  },
  async search(query) {
    const q = (query || '').trim().toLowerCase();
    const remote = await fetchBackendStores();
    if (!q) return remote;
    return remote.filter(
      (s) => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
  },
};

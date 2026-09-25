import { api } from './api.js';

// Sólo tiendas reales y verificadas — sin catálogo de muestra mezclado (ver
// docs/DECISIONES.md). Si el backend no responde, la navegación se degrada
// a "sin resultados" en vez de mostrar negocios que no existen.
// `city` filtra por ubicación real de la tienda (ver server/src/routes/stores.js).
async function fetchBackendStores({ city } = {}) {
  try {
    const qs = new URLSearchParams();
    if (city) qs.set('city', city);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await api.get(`/stores${suffix}`);
  } catch {
    return [];
  }
}

export const storeService = {
  async getAll(city) {
    const remote = await fetchBackendStores({ city });
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
  async search(query, city) {
    const q = (query || '').trim().toLowerCase();
    const remote = await fetchBackendStores({ city });
    if (!q) return remote;
    return remote.filter(
      (s) => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
  },
  // Ciudades reales con al menos una tienda verificada — usado por
  // home.js para ampliar su lista fija de ciudades con las que de verdad
  // tienen cobertura, sin inventar nada.
  async getCities() {
    try {
      return await api.get('/stores/cities');
    } catch {
      return [];
    }
  },
};

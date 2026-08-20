import { products as baseProducts, getProductById as getBaseProductById } from '../data/products.js';
import { getItem, setItem } from './storage.js';

// Simula la latencia de un API real para que la UI pueda mostrar estados de
// carga honestos en vez de renderizar todo de forma instantánea/estática.
const NETWORK_DELAY_MS = 260;
const OVERRIDES_KEY = 'product_overrides';

function delay(ms = NETWORK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadOverrides() {
  return getItem(OVERRIDES_KEY, { added: [], edited: {} });
}

function saveOverrides(overrides) {
  setItem(OVERRIDES_KEY, overrides);
}

// Fusiona el catálogo base (estático) con lo que un vendedor agregó/editó
// desde el panel y persistió en localStorage. Este es el único punto de
// lectura de productos: cuando exista backend, se reemplaza el cuerpo de
// esta función por fetch('/api/products') y el resto de la app no cambia.
function getAllMerged() {
  const overrides = loadOverrides();
  const edited = overrides.edited || {};
  const merged = baseProducts.map((p) => (edited[p.id] ? { ...p, ...edited[p.id] } : p));
  return [...merged, ...(overrides.added || [])];
}

function matchesVehicle(product, vehicle) {
  if (!vehicle || !vehicle.brand) return true;
  return product.compatibility.some((c) => {
    if (c.brand === 'Universal') return true;
    if (c.brand !== vehicle.brand) return false;
    if (vehicle.model && c.model !== vehicle.model) return false;
    if (vehicle.year) {
      const year = Number(vehicle.year);
      if (year < c.yearFrom || year > c.yearTo) return false;
    }
    return true;
  });
}

function compatibilityLabel(product) {
  const c = product.compatibility[0];
  if (!c) return 'Compatibilidad universal';
  if (c.brand === 'Universal') return c.model;
  return `${c.brand} ${c.model} ${c.yearFrom}-${c.yearTo}`;
}

export const productService = {
  // Filtros soportados: { query, brand, model, year, categoryId,
  // availability, type, minPrice, maxPrice }
  async search(filters = {}) {
    await delay();
    const q = (filters.query || '').trim().toLowerCase();
    const vehicle = { brand: filters.brand, model: filters.model, year: filters.year };

    return getAllMerged().filter((p) => {
      if (q) {
        const haystack = `${p.name} ${p.partBrand} ${p.sku}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.categoryId && p.categoryId !== filters.categoryId) return false;
      if (filters.availability && p.availability !== filters.availability) return false;
      if (filters.type && p.type !== filters.type) return false;
      if (filters.minPrice !== '' && filters.minPrice != null && p.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice !== '' && filters.maxPrice != null && p.price > Number(filters.maxPrice)) return false;
      if (!matchesVehicle(p, vehicle)) return false;
      return true;
    });
  },

  async getFeatured(limit = 6) {
    await delay();
    return [...getAllMerged()].sort((a, b) => b.rating - a.rating).slice(0, limit);
  },

  async getById(id) {
    await delay(160);
    return getAllMerged().find((p) => p.id === id) || getBaseProductById(id);
  },

  async getByStore(storeId) {
    await delay(200);
    return getAllMerged().filter((p) => p.storeId === storeId);
  },

  compatibilityLabel,

  // --- Escritura: usada por el panel de vendedor. Persiste sólo en el
  // navegador; contrato listo para POST/PUT /api/stores/:id/products.
  async addProduct(product) {
    await delay(200);
    const overrides = loadOverrides();
    const id = `local-${Date.now()}`;
    const newProduct = { id, rating: 0, reviewsCount: 0, originalPrice: null, ...product };
    overrides.added = [...(overrides.added || []), newProduct];
    saveOverrides(overrides);
    return newProduct;
  },

  async updateProduct(id, patch) {
    await delay(200);
    const overrides = loadOverrides();
    const addedIndex = (overrides.added || []).findIndex((p) => p.id === id);
    if (addedIndex >= 0) {
      overrides.added[addedIndex] = { ...overrides.added[addedIndex], ...patch };
    } else {
      overrides.edited = { ...overrides.edited, [id]: { ...(overrides.edited[id] || {}), ...patch } };
    }
    saveOverrides(overrides);
    return this.getById(id);
  },
};

import { products as baseProducts, getProductById as getBaseProductById } from '../data/products.js';
import { api } from './api.js';

// Simula la latencia de un catálogo local para que la UI pueda mostrar
// estados de carga honestos en vez de renderizar todo de forma instantánea.
const NETWORK_DELAY_MS = 260;

function delay(ms = NETWORK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function applyFilters(list, filters) {
  const q = (filters.query || '').trim().toLowerCase();
  const vehicle = { brand: filters.brand, model: filters.model, year: filters.year };
  return list.filter((p) => {
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
}

// El catálogo local (js/data/products.js) sigue como muestra visual del
// diseño; el backend real (server/) es la fuente de las tiendas y
// productos que se registran de verdad — ver docs/ROADMAP.md. Si el
// backend no está encendido o no es alcanzable, la navegación de compra no
// se rompe: simplemente no aparece nada real todavía (degradación
// silenciosa aceptable acá porque es sólo lectura pública; no así en el
// panel de vendedor, donde un fallo real sí se muestra — ver
// sellerService.js).
async function fetchBackendProducts(params = {}) {
  try {
    const qs = new URLSearchParams();
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.storeId) qs.set('storeId', params.storeId);
    if (params.availability) qs.set('availability', params.availability);
    if (params.type) qs.set('type', params.type);
    if (params.query) qs.set('query', params.query);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await api.get(`/products${suffix}`);
  } catch {
    return [];
  }
}

export const productService = {
  // Filtros soportados: { query, brand, model, year, categoryId,
  // availability, type, minPrice, maxPrice }
  async search(filters = {}) {
    const [local, remote] = await Promise.all([
      delay().then(() => baseProducts),
      fetchBackendProducts({
        categoryId: filters.categoryId, availability: filters.availability, type: filters.type, query: filters.query,
      }),
    ]);
    return applyFilters([...local, ...remote], filters);
  },

  async getFeatured(limit = 6) {
    const [local, remote] = await Promise.all([delay().then(() => baseProducts), fetchBackendProducts()]);
    return [...local, ...remote].sort((a, b) => b.rating - a.rating).slice(0, limit);
  },

  async getById(id) {
    await delay(160);
    const local = getBaseProductById(id);
    if (local) return local;
    try {
      return await api.get(`/products/${id}`);
    } catch {
      return null;
    }
  },

  async getByStore(storeId) {
    await delay(200);
    const local = baseProducts.filter((p) => p.storeId === storeId);
    if (local.length) return local;
    return fetchBackendProducts({ storeId });
  },

  compatibilityLabel,
  matchesVehicle,

  // Deriva un estado de inventario de 3 niveles a partir de availability +
  // stock: 🟢 disponible, 🟡 últimas unidades (poco stock), 🔴 agotado.
  stockTier(product) {
    if (product.availability === 'agotado') return 'agotado';
    if (product.availability === 'en_stock' && product.stock > 0 && product.stock <= 3) return 'bajas';
    if (product.availability === 'en_stock') return 'disponible';
    return 'bajo_pedido';
  },
};

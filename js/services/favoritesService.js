import { getItem, setItem } from './storage.js';

// Favoritos por dispositivo (no por usuario todavía). Contrato simple para
// conectarse a POST/DELETE /api/favorites cuando haya sesión real.
const PRODUCTS_KEY = 'favorites';
const STORES_KEY = 'favorite_stores';
export const FAVORITES_CHANGED_EVENT = 'redauto:favorites-changed';

function makeList(key) {
  return {
    getIds() {
      return getItem(key, []);
    },
    isFavorite(id) {
      return this.getIds().includes(id);
    },
    toggle(id) {
      const ids = this.getIds();
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      setItem(key, next);
      window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT));
      return next.includes(id);
    },
  };
}

const products = makeList(PRODUCTS_KEY);
const stores = makeList(STORES_KEY);

export const favoritesService = {
  getIds: products.getIds.bind(products),
  isFavorite: products.isFavorite.bind(products),
  toggle: products.toggle.bind(products),
  stores: {
    getIds: stores.getIds.bind(stores),
    isFavorite: stores.isFavorite.bind(stores),
    toggle: stores.toggle.bind(stores),
  },
};

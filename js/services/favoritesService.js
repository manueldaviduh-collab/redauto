import { getItem, setItem } from './storage.js';

// Lista de favoritos por dispositivo (no por usuario todavía). Contrato
// simple para conectarse a POST/DELETE /api/favorites cuando haya sesión real.
const KEY = 'favorites';

export const favoritesService = {
  getIds() {
    return getItem(KEY, []);
  },
  isFavorite(productId) {
    return this.getIds().includes(productId);
  },
  toggle(productId) {
    const ids = this.getIds();
    const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
    setItem(KEY, next);
    return next.includes(productId);
  },
};

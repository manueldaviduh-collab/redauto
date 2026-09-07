import { api, ApiError } from './api.js';

// Reseñas reales contra el backend (server/), ligadas a una compra pagada
// (ver server/src/routes/products.js). Reemplaza a js/data/reviews.js, que
// generaba reseñas de muestra deterministas mientras no existía este
// backend.
export const reviewService = {
  async getForProduct(productId) {
    try {
      return await api.get(`/products/${productId}/reviews`);
    } catch {
      return [];
    }
  },

  // Sin sesión, nunca es elegible — no hace falta llamar al backend para
  // saberlo.
  async getEligibility(productId, isLoggedIn) {
    if (!isLoggedIn) return { canReview: false, orderId: null };
    try {
      return await api.get(`/products/${productId}/reviews/eligibility`, { auth: true });
    } catch {
      return { canReview: false, orderId: null };
    }
  },

  async create(productId, { rating, comment }) {
    try {
      const review = await api.post(`/products/${productId}/reviews`, { rating, comment }, { auth: true });
      return { ok: true, review };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'No se pudo publicar la reseña.' };
    }
  },
};

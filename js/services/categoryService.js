import { categories, getCategoryById } from '../data/categories.js';

// Servicio de sólo lectura hoy; el contrato queda listo para
// GET /api/categories cuando exista backend.
export const categoryService = {
  async getAll() {
    return [...categories];
  },
  async getById(id) {
    return getCategoryById(id);
  },
};

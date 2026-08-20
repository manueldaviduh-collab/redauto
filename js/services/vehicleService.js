import { vehicleCatalog, getModels } from '../data/vehicles.js';
import { getItem, setItem, removeItem } from './storage.js';

const PREF_KEY = 'vehicle_pref';

// Contrato pensado para un futuro endpoint de catálogo vehicular
// (GET /api/vehicles/brands, /api/vehicles/:brand/models). Por ahora lee del
// catálogo local en js/data/vehicles.js.
export const vehicleService = {
  getBrands() {
    return [...vehicleCatalog.brands];
  },
  getModels(brand) {
    return getModels(brand);
  },
  getYears() {
    return [...vehicleCatalog.years];
  },
  getPreferred() {
    return getItem(PREF_KEY, null);
  },
  setPreferred(vehicle) {
    setItem(PREF_KEY, vehicle);
  },
  clearPreferred() {
    removeItem(PREF_KEY);
  },
};

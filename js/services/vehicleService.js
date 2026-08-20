import { vehicleCatalog, getModels } from '../data/vehicles.js';
import { getItem, setItem } from './storage.js';

const GARAGE_KEY = 'garage_vehicles';
const ACTIVE_KEY = 'garage_active_id';
export const GARAGE_CHANGED_EVENT = 'redauto:garage-changed';

function readGarage() {
  return getItem(GARAGE_KEY, []);
}

function writeGarage(list) {
  setItem(GARAGE_KEY, list);
  window.dispatchEvent(new CustomEvent(GARAGE_CHANGED_EVENT));
}

// "Mis Vehículos": el garage del comprador. Es la fuente del vehículo activo
// que impulsa los badges de compatibilidad en toda la app. Contrato pensado
// para un futuro endpoint de catálogo vehicular y de vehículos por usuario
// (GET /api/vehicles/brands, GET/POST /api/users/:id/vehicles); por ahora
// vive en localStorage.
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

  getGarage() {
    return readGarage();
  },

  addVehicle({ brand, model, year, engine }) {
    const list = readGarage();
    const vehicle = { id: `veh-${Date.now()}`, brand, model, year: Number(year), engine: engine || '' };
    writeGarage([...list, vehicle]);
    if (list.length === 0) setItem(ACTIVE_KEY, vehicle.id);
    return vehicle;
  },

  removeVehicle(id) {
    const next = readGarage().filter((v) => v.id !== id);
    writeGarage(next);
    if (getItem(ACTIVE_KEY, null) === id) {
      setItem(ACTIVE_KEY, next[0]?.id || null);
    }
  },

  setActive(id) {
    setItem(ACTIVE_KEY, id);
    window.dispatchEvent(new CustomEvent(GARAGE_CHANGED_EVENT));
  },

  getActiveId() {
    return getItem(ACTIVE_KEY, null);
  },

  getActive() {
    const id = this.getActiveId();
    if (!id) return null;
    return readGarage().find((v) => v.id === id) || null;
  },
};

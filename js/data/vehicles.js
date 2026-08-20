// Catálogo de vehículos para el selector de compatibilidad.
// Sustituible por un endpoint de catálogo vehicular (marca/modelo/año) sin
// tocar la UI, ya que sólo se consume a través de vehicleService.
export const vehicleCatalog = {
  brands: ['Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Kia', 'Renault', 'Nissan', 'Fiat'],
  modelsByBrand: {
    Toyota: ['Corolla', 'Yaris', 'Hilux', 'Fortuner', 'Camry'],
    Chevrolet: ['Aveo', 'Optra', 'Spark', 'Cruze', 'Silverado'],
    Ford: ['Fiesta', 'Focus', 'Explorer', 'Ranger'],
    Hyundai: ['Accent', 'Elantra', 'Tucson', 'i10'],
    Kia: ['Rio', 'Sportage', 'Picanto', 'Cerato'],
    Renault: ['Sandero', 'Logan', 'Duster', 'Clio'],
    Nissan: ['Sentra', 'Versa', 'X-Trail', 'Frontier'],
    Fiat: ['Palio', 'Uno', 'Siena'],
  },
  years: Array.from({ length: 2025 - 2008 + 1 }, (_, i) => 2025 - i),
};

export function getModels(brand) {
  return vehicleCatalog.modelsByBrand[brand] || [];
}

// Catálogo de categorías. En producción este listado vendría de un endpoint
// tipo GET /api/categories — se mantiene aquí como fuente única mientras tanto.
export const categories = [
  { id: 'motor', name: 'Motor', icon: 'cog' },
  { id: 'frenos', name: 'Frenos', icon: 'disc' },
  { id: 'suspension', name: 'Suspensión', icon: 'activity' },
  { id: 'baterias', name: 'Baterías', icon: 'batteryCharging' },
  { id: 'aceites', name: 'Aceites y Lubricantes', icon: 'droplet' },
  { id: 'filtros', name: 'Filtros', icon: 'filter' },
  { id: 'iluminacion', name: 'Iluminación', icon: 'lightbulb' },
  { id: 'cauchos', name: 'Cauchos', icon: 'circleDot' },
];

export function getCategoryById(id) {
  return categories.find((c) => c.id === id) || null;
}

// Único lugar que sabe dónde vive el backend real. Se puede sobreescribir
// sin tocar el bundle poniendo `window.REDAUTO_API_URL = '...'` antes de
// cargar js/app.js (ver index.html) — así el mismo index.html sirve para
// desarrollo local y para producción, cambiando una sola línea.
export const API_BASE_URL = (typeof window !== 'undefined' && window.REDAUTO_API_URL) || 'http://localhost:4000/api';

// Si no hay backend configurado/alcanzable, la app lo dice explícitamente
// en vez de simular una cuenta o un producto que no existe de verdad (ver
// docs/PRINCIPIOS.md §4, Transparencia).
export const BACKEND_REQUIRED_MESSAGE =
  'No se pudo conectar con el servidor de RedAuto. Verifica tu conexión, o que el backend esté encendido (ver server/README.md).';

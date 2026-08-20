// Envoltorio único sobre localStorage. Toda persistencia local del MVP pasa
// por aquí (carrito, sesión, preferencia de vehículo, overrides de vendedor,
// pedidos demo) para que sea fácil auditar qué vive en el cliente y migrarlo
// a un backend real sin tocar cada servicio por separado.
const NAMESPACE = 'redauto_';

export function getItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(NAMESPACE + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(NAMESPACE + key);
  } catch (err) {
    /* almacenamiento no disponible (modo privado, cuota, etc.) */
  }
}

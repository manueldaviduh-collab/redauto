// Valores compartidos entre playwright.config.js, global-setup.js y los
// specs — un solo lugar para no repetir la cadena de conexión/puertos.
// En CI, sobreescribe DATABASE_URL por variable de entorno; el resto casi
// nunca hace falta tocarlo.
export const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://redauto:localtest123@localhost:5432/redauto';
export const JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret-not-for-production';
export const API_PORT = 4000;
export const API_BASE_URL = `http://localhost:${API_PORT}/api`;
export const FRONTEND_PORT = 8080;
export const FRONTEND_BASE_URL = `http://localhost:${FRONTEND_PORT}`;

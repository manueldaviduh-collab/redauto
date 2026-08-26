import { getItem, setItem, removeItem } from './storage.js';
import { api, ApiError } from './api.js';

// Autenticación real contra el backend (server/) — sin cuentas de demo, sin
// contraseñas comparadas en el cliente. El token (JWT) y una copia liviana
// del usuario/tienda actual se cachean en localStorage sólo para que
// `getCurrentUser()` pueda seguir siendo síncrono (así ninguna pantalla que
// ya lo llama sin `await` — profile.js, seller.js, checkout.js — necesita
// cambiar). La fuente de verdad sigue siendo el backend: `refreshSession()`
// la vuelve a consultar.
const TOKEN_KEY = 'auth_token';
const SESSION_KEY = 'auth_session'; // { id, name, email, phone, city, role, storeId }

function toSession(user, store) {
  return { ...user, storeId: store?.id || null };
}

export const authService = {
  async login(email, password) {
    try {
      const { token, user, store } = await api.post('/auth/login', { email, password });
      setItem(TOKEN_KEY, token);
      setItem(SESSION_KEY, toSession(user, store));
      return { ok: true, user: toSession(user, store) };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.' };
    }
  },

  // storeName es opcional: si se manda, la cuenta se crea como vendedor con
  // su propia tienda ya asociada (ver server/src/routes/auth.js). Sin
  // storeName, es una cuenta de comprador normal.
  async register({ name, email, password, phone, city, storeName }) {
    try {
      const { token, user, store } = await api.post('/auth/register', {
        name, email, password, phone, city, storeName,
      });
      setItem(TOKEN_KEY, token);
      setItem(SESSION_KEY, toSession(user, store));
      return { ok: true, user: toSession(user, store) };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.' };
    }
  },

  logout() {
    removeItem(TOKEN_KEY);
    removeItem(SESSION_KEY);
  },

  getCurrentUser() {
    return getItem(SESSION_KEY, null);
  },

  isAuthenticated() {
    return !!getItem(TOKEN_KEY, null);
  },

  isSeller() {
    return this.getCurrentUser()?.role === 'vendedor';
  },

  // Refresca la sesión cacheada contra el backend (por si el usuario cambió
  // algo desde otro dispositivo). No es necesario llamarlo para que la app
  // funcione — es una mejora opcional para pantallas que quieran datos
  // frescos (ej. al entrar al panel de vendedor).
  async refreshSession() {
    if (!this.isAuthenticated()) return null;
    try {
      const { user, store } = await api.get('/auth/me', { auth: true });
      const session = toSession(user, store);
      setItem(SESSION_KEY, session);
      return session;
    } catch {
      this.logout();
      return null;
    }
  },
};

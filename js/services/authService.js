import { demoUsers } from '../data/users.js';
import { getItem, setItem, removeItem } from './storage.js';

// Autenticación 100% local para el MVP: valida contra las cuentas demo y
// contra las cuentas registradas en este navegador. `getSession`/`login` son
// el único contrato que la UI conoce, por lo que sustituir esto por JWT/OAuth
// contra un backend real no debería tocar las pantallas.
const SESSION_KEY = 'session';
const EXTRA_USERS_KEY = 'users_extra';

function allUsers() {
  return [...demoUsers, ...getItem(EXTRA_USERS_KEY, [])];
}

function delay(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const authService = {
  async login(email, password) {
    await delay();
    const user = allUsers().find(
      (u) => u.email.toLowerCase() === (email || '').toLowerCase().trim()
    );
    if (!user) return { ok: false, error: 'No existe una cuenta con ese correo.' };
    if (user.password !== password) return { ok: false, error: 'Contraseña incorrecta.' };
    setItem(SESSION_KEY, { userId: user.id, role: user.role });
    return { ok: true, user };
  },

  async register({ name, email, password, phone, city }) {
    await delay();
    const emailNorm = (email || '').toLowerCase().trim();
    if (!name || name.trim().length < 2) return { ok: false, error: 'Ingresa tu nombre completo.' };
    if (!/^\S+@\S+\.\S+$/.test(emailNorm)) return { ok: false, error: 'Ingresa un correo válido.' };
    if (!password || password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    if (allUsers().some((u) => u.email.toLowerCase() === emailNorm)) {
      return { ok: false, error: 'Ya existe una cuenta con ese correo.' };
    }
    const user = {
      id: `local-${Date.now()}`,
      role: 'comprador',
      name: name.trim(),
      email: emailNorm,
      password,
      phone: phone || '',
      city: city || 'Caracas',
    };
    const extra = getItem(EXTRA_USERS_KEY, []);
    setItem(EXTRA_USERS_KEY, [...extra, user]);
    setItem(SESSION_KEY, { userId: user.id, role: user.role });
    return { ok: true, user };
  },

  logout() {
    removeItem(SESSION_KEY);
  },

  getSession() {
    return getItem(SESSION_KEY, null);
  },

  getCurrentUser() {
    const session = this.getSession();
    if (!session) return null;
    return allUsers().find((u) => u.id === session.userId) || null;
  },

  isAuthenticated() {
    return !!this.getSession();
  },

  isSeller() {
    return this.getSession()?.role === 'vendedor';
  },
};

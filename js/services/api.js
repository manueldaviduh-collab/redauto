import { API_BASE_URL, BACKEND_REQUIRED_MESSAGE } from '../config.js';
import { getItem } from './storage.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Cliente HTTP delgado hacia el backend real (server/). Ningún otro
// archivo del frontend arma una URL de API o lee el token a mano — todo
// pasa por acá, igual que localStorage sólo se toca a través de
// services/storage.js.
async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getItem('auth_token', null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(BACKEND_REQUIRED_MESSAGE, 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo (ej. 204) */
  }

  if (!res.ok) {
    throw new ApiError(data?.error || 'Ocurrió un error inesperado.', res.status);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),

  // Subida de archivos (multipart/form-data) — usada por la importación
  // masiva por Excel (ver js/ui/productImport.js). No pasa por request()
  // porque el body NO debe ser JSON.stringify'd y el navegador tiene que
  // poner su propio Content-Type con el boundary del multipart.
  async upload(path, formData, { auth = false } = {}) {
    const headers = {};
    if (auth) {
      const token = getItem('auth_token', null);
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
    } catch {
      throw new ApiError(BACKEND_REQUIRED_MESSAGE, 0);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* respuesta sin cuerpo */
    }
    if (!res.ok) {
      throw new ApiError(data?.error || 'Ocurrió un error inesperado.', res.status);
    }
    return data;
  },

  // Descarga un archivo binario (la plantilla de Excel) y dispara el
  // guardado en el navegador. No pasa por request() porque la respuesta no
  // es JSON.
  async download(path, filename, { auth = false } = {}) {
    const headers = {};
    if (auth) {
      const token = getItem('auth_token', null);
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, { headers });
    } catch {
      throw new ApiError(BACKEND_REQUIRED_MESSAGE, 0);
    }
    if (!res.ok) {
      throw new ApiError('No se pudo descargar el archivo.', res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

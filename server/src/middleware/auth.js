import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET. Definilo en server/.env (ver server/.env.example).');
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

// Exige un Authorization: Bearer <token> válido y adjunta { id, role } a
// req.auth. Cualquier ruta que toque datos de un vendedor concreto (crear/
// editar sus productos) pasa por acá — nunca confía en un storeId que venga
// del body/query del cliente sin verificar contra el dueño real (ver
// requireStoreOwnership en routes/products.js).
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o vencida. Inicia sesión de nuevo.' });
  }
}

// Igual que requireAuth, pero nunca rechaza: si no hay token o es inválido,
// simplemente sigue sin req.auth. Sirve para rutas públicas que además
// quieren dar más acceso si quien pregunta resulta ser un admin (ver GET
// /api/stores/:id) sin duplicar la ruta en una versión "pública" y otra
// "de admin".
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.auth = { id: payload.sub, role: payload.role };
    } catch {
      // Token vencido/inválido en una ruta pública: se ignora, no se rechaza.
    }
  }
  next();
}

export function requireSeller(req, res, next) {
  if (req.auth?.role !== 'vendedor') {
    return res.status(403).json({ error: 'Esta acción es solo para cuentas de tienda.' });
  }
  next();
}

// Nadie tiene este rol por defecto — se asigna a mano (ver server/README.md,
// "Aprobar una tienda"). Sin panel de administración todavía (ver
// docs/ROADMAP.md, Etapa 2): este endpoint existe para cuando lo haya, y
// mientras tanto el fundador aprueba tiendas directo por SQL.
export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Esta acción requiere una cuenta de administrador.' });
  }
  next();
}

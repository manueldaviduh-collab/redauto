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

export function requireSeller(req, res, next) {
  if (req.auth?.role !== 'vendedor') {
    return res.status(403).json({ error: 'Esta acción es solo para cuentas de tienda.' });
  }
  next();
}

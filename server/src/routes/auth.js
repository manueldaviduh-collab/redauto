import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, city: row.city, role: row.role };
}

function publicStore(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    city: row.city,
    address: row.address,
    phone: row.phone,
    about: row.about,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
  };
}

// POST /api/auth/register
// Sin storeName -> cuenta de comprador. Con storeName -> cuenta de
// vendedor + su tienda, creadas en la misma transacción. Este es el
// mecanismo real (no una demo) para que una tienda real se dé de alta.
authRouter.post('/register', async (req, res) => {
  const { name, email, password, phone, city, storeName } = req.body || {};

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'Ingresa tu nombre completo.' });
  }
  const emailNorm = String(email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(emailNorm)) {
    return res.status(400).json({ error: 'Ingresa un correo válido.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  const wantsStore = !!(storeName && String(storeName).trim().length >= 2);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [emailNorm]);
    if (existing.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const role = wantsStore ? 'vendedor' : 'comprador';
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, city, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [String(name).trim(), emailNorm, passwordHash, phone || null, city || null, role]
    );
    const user = userResult.rows[0];

    let store = null;
    if (wantsStore) {
      const storeResult = await client.query(
        `INSERT INTO stores (owner_user_id, name, city, phone)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [user.id, String(storeName).trim(), city || null, phone || null]
      );
      store = storeResult.rows[0];
    }

    await client.query('COMMIT');
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user), store: publicStore(store) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en /auth/register', err);
    res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' });
  } finally {
    client.release();
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const emailNorm = String(email || '').toLowerCase().trim();

  const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [emailNorm]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'No existe una cuenta con ese correo.' });

  const valid = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta.' });

  const storeResult = await pool.query('SELECT * FROM stores WHERE owner_user_id = $1', [user.id]);
  const token = signToken(user);
  res.json({ token, user: publicUser(user), store: publicStore(storeResult.rows[0]) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.auth.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Cuenta no encontrada.' });

  const storeResult = await pool.query('SELECT * FROM stores WHERE owner_user_id = $1', [user.id]);
  res.json({ user: publicUser(user), store: publicStore(storeResult.rows[0]) });
});

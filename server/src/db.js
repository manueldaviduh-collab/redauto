import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Falta DATABASE_URL. Copia server/.env.example a server/.env y completa la conexión a tu base de datos Postgres.'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Habilita SSL sólo cuando el proveedor lo exige (Supabase/Railway/etc. en
  // producción); en local (Postgres del propio sandbox) no hace falta.
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export async function query(text, params) {
  return pool.query(text, params);
}

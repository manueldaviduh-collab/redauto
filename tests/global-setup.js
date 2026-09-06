// Se corre una sola vez, antes de levantar los webServer de
// playwright.config.js. Deja Postgres arriba, el rol/base de datos local
// de pruebas creados, y el schema aplicado — todo idempotente (seguro de
// correr una y otra vez, en esta sandbox o en una máquina nueva).
//
// No borra ni resetea nada existente a propósito: cada spec crea sus
// propios usuarios/tiendas/productos con datos únicos (sufijo aleatorio),
// así que no hace falta una base "limpia" en cada corrida.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATABASE_URL } from './fixtures/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', 'server', 'src', 'schema.sql');

function sh(cmd) {
  return execSync(cmd, { stdio: 'pipe', shell: '/bin/bash' }).toString();
}

function isPostgresUp() {
  try {
    sh('pg_isready -q');
    return true;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  if (!isPostgresUp()) {
    try {
      sh('service postgresql start');
    } catch (err) {
      console.warn(
        '[global-setup] No pude arrancar Postgres con "service postgresql start" ' +
        '(¿no es Linux/Debian, o ya lo maneja tu entorno de otra forma?). ' +
        'Asumo que ya está corriendo y sigo. Detalle:', err.message
      );
    }
    for (let i = 0; i < 10 && !isPostgresUp(); i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Rol y base de datos locales de prueba — idempotente. Usa peer auth
  // como "postgres" (funciona en la sandbox de desarrollo; en CI, provee
  // Postgres ya con el rol/base creados y esto simplemente no hace falta).
  try {
    sh(`su postgres -c "psql -tc \\"SELECT 1 FROM pg_roles WHERE rolname='redauto'\\"" | grep -q 1 || ` +
       `su postgres -c "psql -c \\"CREATE ROLE redauto LOGIN PASSWORD 'localtest123';\\""`);
    sh(`su postgres -c "psql -tc \\"SELECT 1 FROM pg_database WHERE datname='redauto'\\"" | grep -q 1 || ` +
       `su postgres -c "psql -c \\"CREATE DATABASE redauto OWNER redauto;\\""`);
  } catch (err) {
    console.warn(
      '[global-setup] No pude crear el rol/base "redauto" automáticamente — ' +
      'si ya existen (o tu entorno los provee de otra forma) esto es normal. Detalle:',
      err.message
    );
  }

  sh(`psql "${DATABASE_URL}" -f "${SCHEMA_PATH}"`);
  console.log('[global-setup] Postgres listo, schema aplicado.');
}

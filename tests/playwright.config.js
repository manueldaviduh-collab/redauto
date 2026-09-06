import { defineConfig } from '@playwright/test';
import { DATABASE_URL, JWT_SECRET, API_PORT, API_BASE_URL, FRONTEND_PORT } from './fixtures/env.js';

// Suite de humo del camino crítico (ver docs/ROADMAP.md, Etapa 1 — "qué
// falta todavía"). Levanta el backend real (server/) contra Postgres local
// y sirve el frontend estático real, sin build step — exactamente como
// corre en producción, sólo que apuntando a localhost (ver
// fixtures/appRoute.js). No usa ningún dato de muestra: cada spec crea sus
// propios usuarios/tienda/producto con datos únicos.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // los specs comparten el mismo backend/Postgres local
  retries: 0,
  reporter: [['list']],
  globalSetup: './global-setup.js',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // Fija el binario ya cacheado en la sandbox en vez de dejar que
      // Playwright intente descargar uno que combine con la versión exacta
      // de @playwright/test instalada.
      executablePath: '/opt/pw-browsers/chromium',
    },
  },
  webServer: [
    {
      command: 'npm start',
      cwd: '../server',
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
      env: {
        DATABASE_URL,
        DATABASE_SSL: 'false',
        JWT_SECRET,
        PORT: String(API_PORT),
        CORS_ORIGIN: '*',
      },
    },
    {
      command: `node fixtures/static-server.mjs ${FRONTEND_PORT} ${API_BASE_URL}`,
      cwd: '.',
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
  ],
});

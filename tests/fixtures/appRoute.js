// Navega a la app real, servida por fixtures/static-server.mjs (ver ese
// archivo para por qué no se usa page.route() para esto). Sin build step:
// es el mismo index.html/js/css del repo, solo que en localhost.
import { FRONTEND_BASE_URL } from './env.js';

export async function gotoApp(page, hash = '/') {
  await page.goto(`${FRONTEND_BASE_URL}/#${hash}`, { waitUntil: 'load' });
  // El splash tarda ~2s coreografiados antes de poder ocultarse (ver
  // js/app.js) — esperarlo acá evita que cada spec repita este número.
  await page.waitForTimeout(2300);
}

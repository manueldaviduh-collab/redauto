import { startRouter } from './router.js';

// 2000ms le da tiempo a la secuencia coreografiada del splash (logo → brillo
// → nombre → tagline → barra) para asentarse antes de desaparecer — ver
// css/styles.css, sección "Splash screen".
const SPLASH_MIN_MS = 2000;
const splashShownAt = Date.now();

startRouter();

function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  splash.classList.add('is-hidden');
}

const elapsed = Date.now() - splashShownAt;
setTimeout(dismissSplash, Math.max(0, SPLASH_MIN_MS - elapsed));

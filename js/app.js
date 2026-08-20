import { startRouter } from './router.js';

const SPLASH_MIN_MS = 1700;
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

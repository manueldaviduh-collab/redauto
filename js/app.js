import { startRouter } from './router.js';

// PANEL DE DIAGNÓSTICO TEMPORAL — quitar una vez resuelto el bug de la
// barra inferior en iOS (ver conversación). Muestra las medidas reales del
// viewport y de la barra inferior directamente en pantalla, para
// diagnosticar sin depender de interpretar capturas de pantalla.
// TEMPORALMENTE siempre visible (sin el gate de ?debug=1) para poder leerlo
// también desde la app instalada en el Home Screen, que no tiene barra de
// direcciones donde escribir el query param — volver a poner el gate (o
// quitar el panel entero) apenas se confirme el diagnóstico.
if (true) {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:#0f0', 'color:#000', 'font:11px/1.4 monospace',
    'padding:6px 8px', 'white-space:pre-wrap', 'pointer-events:none',
  ].join(';');
  document.body.appendChild(panel);
  function paintDebug() {
    const nav = document.querySelector('.bottom-nav');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const shell = document.querySelector('.app-shell');
    const shellRect = shell ? shell.getBoundingClientRect() : null;
    const cs = getComputedStyle(document.documentElement);
    panel.textContent = [
      `window.innerHeight=${window.innerHeight}`,
      `visualViewport.height=${window.visualViewport ? window.visualViewport.height : 'n/a'}`,
      `document.documentElement.clientHeight=${document.documentElement.clientHeight}`,
      `body.clientHeight=${document.body.clientHeight}`,
      `--safe-bottom=${cs.getPropertyValue('--safe-bottom')}`,
      `app-shell rect: top=${shellRect?.top} bottom=${shellRect?.bottom} height=${shellRect?.height}`,
      `bottom-nav rect: top=${navRect?.top} bottom=${navRect?.bottom} height=${navRect?.height}`,
      `screen.height=${window.screen ? window.screen.height : 'n/a'}`,
      `devicePixelRatio=${window.devicePixelRatio}`,
      `standalone=${window.navigator.standalone}`,
    ].join('\n');
  }
  paintDebug();
  window.addEventListener('resize', paintDebug);
  window.visualViewport?.addEventListener('resize', paintDebug);
  setInterval(paintDebug, 1000);
}

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

import { parseHash } from './nav.js';
import { bottomNavHtml } from './ui/components.js';
import { cartService, CART_CHANGED_EVENT } from './services/cartService.js';
import { closeModal } from './ui/modal.js';

import * as home from './screens/home.js';
import * as search from './screens/search.js';
import * as product from './screens/product.js';
import * as stores from './screens/stores.js';
import * as storeDetail from './screens/storeDetail.js';
import * as cart from './screens/cart.js';
import * as checkout from './screens/checkout.js';
import * as login from './screens/login.js';
import * as register from './screens/register.js';
import * as profile from './screens/profile.js';
import * as seller from './screens/seller.js';
import * as myVehicles from './screens/myVehicles.js';
import * as favorites from './screens/favorites.js';
import * as notifications from './screens/notifications.js';

const ROUTES = [
  { test: (s) => s.length === 0, screen: home, root: '/' },
  { test: (s) => s[0] === 'buscar', screen: search, root: '/buscar' },
  { test: (s) => s[0] === 'producto' && s[1], screen: product },
  { test: (s) => s[0] === 'tiendas', screen: stores, root: '/tiendas' },
  { test: (s) => s[0] === 'tienda' && s[1], screen: storeDetail },
  { test: (s) => s[0] === 'carrito', screen: cart, root: '/carrito' },
  { test: (s) => s[0] === 'checkout', screen: checkout },
  { test: (s) => s[0] === 'login', screen: login },
  { test: (s) => s[0] === 'registro', screen: register },
  { test: (s) => s[0] === 'perfil', screen: profile, root: '/perfil' },
  { test: (s) => s[0] === 'vendedor', screen: seller },
  { test: (s) => s[0] === 'mis-vehiculos', screen: myVehicles },
  { test: (s) => s[0] === 'favoritos', screen: favorites },
  { test: (s) => s[0] === 'notificaciones', screen: notifications },
];

let currentToken = 0;

export function startRouter() {
  window.addEventListener('hashchange', renderCurrentRoute);
  window.addEventListener(CART_CHANGED_EVENT, updateCartBadges);
  renderCurrentRoute();
}

async function renderCurrentRoute() {
  closeModal();
  const token = ++currentToken;
  const { path, segments, query } = parseHash();
  const match = ROUTES.find((r) => r.test(segments)) || ROUTES[0];

  const screenContent = document.getElementById('screen-content');
  const bottomNavRoot = document.getElementById('bottom-nav-root');

  if (bottomNavRoot) bottomNavRoot.innerHTML = bottomNavHtml(match.root || null);
  screenContent.classList.remove('screen-content--with-sticky-actions');
  updateCartBadges();

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  // Entrada suave por navegación: la clase se agrega antes de invocar
  // render() (cubre el primer paint síncrono, típicamente un skeleton) y se
  // retira en el siguiente frame — o sea, apenas se pinta ese primer
  // estado, no cuando termina de cargar. Así no se le suma latencia a la
  // navegación ni se oculta el propio skeleton mientras llegan los datos.
  screenContent.classList.add('screen-enter');
  const renderPromise = match.screen.render(screenContent, { path, segments, query });
  requestAnimationFrame(() => screenContent.classList.remove('screen-enter'));

  try {
    await renderPromise;
  } catch (err) {
    if (token !== currentToken) return;
    console.error('Error al renderizar la pantalla', err);
    screenContent.innerHTML = `
      <div class="screen-pad">
        <div class="empty-state">
          <p class="empty-state__title">Ocurrió un error al cargar esta pantalla</p>
          <p class="empty-state__message">Intenta volver al inicio.</p>
          <a class="btn btn--primary" href="#/">Volver al inicio</a>
        </div>
      </div>`;
  }
}

function updateCartBadges() {
  const count = cartService.getRawCount();
  document.querySelectorAll('#nav-cart-count, #home-cart-count').forEach((el) => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
}

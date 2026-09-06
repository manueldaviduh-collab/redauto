// Service worker de RedAuto — solo cachea el shell estático de la app
// (HTML/CSS/JS/íconos). Nunca cachea /api/ ni nada cross-origin: los datos
// reales (backend, ver server/) siempre van directo a la red. Ver
// docs/ARQUITECTURA.md para cómo esto se conecta con el resto del proyecto.
//
// Estrategia: network-first para el shell. Cada visita pide la versión de
// red primero y la sirve (así una actualización publicada se ve de
// inmediato, sin recargar dos veces) y sólo si no hay red cae a la copia en
// caché (para que la app siga abriendo sin conexión). Antes era
// stale-while-revalidate (servía la caché vieja al instante y recién
// actualizaba en segundo plano) — eso mostraba la versión anterior en la
// primera visita después de cada despliegue, hasta la siguiente recarga.
// Cambiar CACHE_VERSION fuerza además una limpieza completa de caché
// (usarlo si algún día hace falta invalidar todo de una vez).
const CACHE_VERSION = 'redauto-shell-v4';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/styles.css',
  '/js/app.js',
  '/js/config.js',
  '/js/nav.js',
  '/js/router.js',
  '/js/data/categories.js',
  '/js/data/notifications.js',
  '/js/data/reviews.js',
  '/js/data/vehicles.js',
  '/js/screens/cart.js',
  '/js/screens/checkout.js',
  '/js/screens/favorites.js',
  '/js/screens/home.js',
  '/js/screens/login.js',
  '/js/screens/myVehicles.js',
  '/js/screens/notifications.js',
  '/js/screens/product.js',
  '/js/screens/profile.js',
  '/js/screens/register.js',
  '/js/screens/search.js',
  '/js/screens/seller.js',
  '/js/screens/admin.js',
  '/js/screens/storeDetail.js',
  '/js/screens/stores.js',
  '/js/services/api.js',
  '/js/services/adminService.js',
  '/js/services/authService.js',
  '/js/services/cartService.js',
  '/js/services/categoryService.js',
  '/js/services/favoritesService.js',
  '/js/services/notificationService.js',
  '/js/services/orderService.js',
  '/js/services/productService.js',
  '/js/services/sellerService.js',
  '/js/services/storage.js',
  '/js/services/storeService.js',
  '/js/services/vehicleService.js',
  '/js/ui/chat.js',
  '/js/ui/components.js',
  '/js/ui/icons.js',
  '/js/ui/modal.js',
  '/js/ui/productArt.js',
  '/js/ui/productImport.js',
  '/js/ui/toast.js',
  '/js/data/venezuelaStates.js',
  '/js/pwa.js',
  '/assets/favicon.png',
  '/assets/logo-mark.png',
  '/assets/splash-logo.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/apple-touch-icon-120.png',
  '/assets/icons/apple-touch-icon-152.png',
  '/assets/icons/apple-touch-icon-167.png',
  '/assets/icons/apple-touch-icon-180.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-192-maskable.png',
  '/assets/icons/icon-512-maskable.png',
  '/assets/icons/favicon-16.png',
  '/assets/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  // Nunca cachear el backend real (ni si algún día se sirve bajo el mismo
  // origen bajo /api/) — los datos de tiendas/productos/cuentas siempre
  // tienen que venir frescos de la red.
  return url.pathname.startsWith('/api/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Google Fonts, API en otro host, etc. — directo a red
  if (isApiRequest(url)) return;

  // Las navegaciones (abrir la app) pueden traer query strings distintas
  // (ej. el start_url "/?source=pwa" al abrir desde el ícono en el Home
  // Screen) — se normalizan todas a una sola entrada de caché ("/") para
  // que sigan sirviendo el shell al instante sin importar el query string.
  const isNavigation = request.mode === 'navigate';
  const cacheKey = isNavigation ? '/' : request;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        // no-store: sin esto, el navegador puede servir el propio caché
        // HTTP (no el de este service worker) para esta misma URL, y el
        // "network-first" de acá nunca llegaría a tocar la red de verdad.
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) cache.put(cacheKey, response.clone());
        return response;
      } catch {
        // Sin red (offline) — cae a la copia en caché más reciente.
        const cached = await cache.match(cacheKey);
        return cached || Response.error();
      }
    })()
  );
});

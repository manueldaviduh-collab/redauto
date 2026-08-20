// Único punto para cambiar de pantalla. Vive separado del router para que
// las pantallas puedan navegar sin crear un import circular con router.js.
export function navigate(path) {
  const hash = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, queryString] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString || ''));
  const segments = path.split('/').filter(Boolean);
  return { path: `/${segments.join('/')}`, segments, query };
}

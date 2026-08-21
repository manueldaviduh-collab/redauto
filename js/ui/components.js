import { icon } from './icons.js';
import { productArt } from './productArt.js';
import { getCategoryById } from '../data/categories.js';
import { productService } from '../services/productService.js';
import { cartService } from '../services/cartService.js';
import { favoritesService } from '../services/favoritesService.js';
import { vehicleService } from '../services/vehicleService.js';
import { showToast } from './toast.js';
import { navigate } from '../nav.js';

const STAR_PATH = 'M12 3.5 14.6 9l6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8Z';

// Estrella rellena (no trazo): a tamaños chicos un ícono sólo-contorno no
// se lee como "estrella de calificación". Se usa en vez de icon('star', …)
// en todo lo que muestre rating.
function starGlyph(size, className = '') {
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

export function whatsappLink(phone, message) {
  const digits = String(phone).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const DELIVERY_OPTION_LABEL = { hoy: 'Entrega hoy', manana: 'Entrega mañana', retiro: 'Retiro en tienda' };
const DELIVERY_OPTION_ICON = { hoy: 'truck', manana: 'truck', retiro: 'mapPin' };

export function deliveryOptionsRow(options = []) {
  if (!options.length) return '';
  return `<div class="delivery-options">${options
    .map((o) => `<span class="delivery-chip">${icon(DELIVERY_OPTION_ICON[o] || 'truck', { size: 13 })} ${DELIVERY_OPTION_LABEL[o] || o}</span>`)
    .join('')}</div>`;
}

const STOCK_TIER = {
  disponible: { modifier: 'ok', label: 'Disponible', dot: '🟢' },
  bajas: { modifier: 'wait', label: 'Últimas unidades', dot: '🟡' },
  agotado: { modifier: 'off', label: 'Agotado', dot: '🔴' },
  bajo_pedido: { modifier: 'wait', label: 'Bajo pedido', dot: '🟡' },
};

// Estado de inventario en 3 niveles (disponible / últimas unidades /
// agotado), derivado de availability + stock. `bajo_pedido` es un cuarto
// estado propio del modelo (se puede encargar aunque no haya stock local).
export function availabilityBadge(product) {
  const tier = STOCK_TIER[productService.stockTier(product)];
  return `<span class="badge badge--${tier.modifier}"><span aria-hidden="true">${tier.dot}</span> ${tier.label}</span>`;
}

export function typeBadge(type) {
  return `<span class="badge badge--neutral">${type === 'original' ? 'Original' : 'Alternativo'}</span>`;
}

export function verifiedBadge({ compact = false } = {}) {
  return `<span class="badge badge--verified">${icon('shieldCheck', { size: 13 })}${compact ? '' : ' Tienda verificada RedAuto'}</span>`;
}

export function discountBadge(percent) {
  return `<span class="badge badge--discount">-${percent}%</span>`;
}

export function ratingInline(rating, reviewsCount) {
  return `<span class="rating">${starGlyph(13, 'rating__icon')}${rating.toFixed(1)}${
    reviewsCount != null ? ` <span class="rating__count">(${reviewsCount})</span>` : ''
  }</span>`;
}

// Compatibilidad inteligente: cuando el usuario tiene un vehículo activo en
// "Mis Vehículos", se resalta si el producto le sirve. `variant: 'banner'`
// se usa en el detalle de producto (también avisa cuando NO coincide);
// `inline` (por defecto, para tarjetas de resultados) sólo resalta el match
// positivo para no llenar la grilla de advertencias.
export function compatibilityNote(product, { variant = 'inline' } = {}) {
  const activeVehicle = vehicleService.getActive();
  if (!activeVehicle) return null;
  const matches = productService.matchesVehicle(product, activeVehicle);
  const label = `${activeVehicle.brand} ${activeVehicle.model} ${activeVehicle.year}`;
  if (variant === 'banner') {
    return matches
      ? `<div class="compat-banner compat-banner--ok">${icon('check', { size: 15 })} Compatible con tu ${escapeHtml(label)}</div>`
      : `<div class="compat-banner compat-banner--warn">${icon('info', { size: 15 })} No está confirmado para tu ${escapeHtml(label)} — revisa la compatibilidad completa abajo</div>`;
  }
  if (!matches) return null;
  return `<p class="compat-inline">${icon('check', { size: 12 })} Compatible con tu ${escapeHtml(label)}</p>`;
}

function discountPercent(product) {
  if (!product.originalPrice || product.originalPrice <= product.price) return null;
  return Math.round(100 - (product.price / product.originalPrice) * 100);
}

// Marcador visual del producto: no hay fotografías reales en el MVP, así que
// se usa un tile con el ícono de categoría sobre un degradado — mantiene
// densidad visual sin depender de assets externos.
export function productTile(product) {
  const category = getCategoryById(product.categoryId);
  return `<div class="product-tile" role="img" aria-label="${escapeHtml(category?.name || 'Repuesto')}">${productArt(product.categoryId)}</div>`;
}

export function productCard(product, store) {
  const pct = discountPercent(product);
  const isFav = favoritesService.isFavorite(product.id);
  const compat = compatibilityNote(product);
  return `
  <article class="product-card" data-product-id="${product.id}" tabindex="0" role="button" aria-label="${escapeHtml(product.name)}">
    <div class="product-card__media">
      ${productTile(product)}
      ${pct ? discountBadge(pct) : ''}
      <button type="button" class="icon-btn product-card__fav ${isFav ? 'is-active' : ''}" data-action="favorite" aria-label="Guardar en favoritos">${icon('heart', { size: 16 })}</button>
    </div>
    <div class="product-card__body">
      <p class="product-card__name">${escapeHtml(product.name)}</p>
      ${compat || `<p class="product-card__compat">${escapeHtml(productService.compatibilityLabel(product))}</p>`}
      <div class="product-card__price-row">
        <span class="product-card__price">${formatPrice(product.price)}</span>
        ${product.originalPrice ? `<span class="product-card__price-old">${formatPrice(product.originalPrice)}</span>` : ''}
      </div>
      <div class="product-card__meta">
        ${availabilityBadge(product)}
        ${ratingInline(product.rating, product.reviewsCount)}
      </div>
      ${store ? `<p class="product-card__store">${escapeHtml(store.name)} ${icon('shieldCheck', { size: 12, className: 'store-check' })}</p>` : ''}
    </div>
    <button type="button" class="btn-icon-primary product-card__add" data-action="add-to-cart" aria-label="Agregar al carrito" ${product.availability === 'agotado' ? 'disabled' : ''}>${icon('cart', { size: 18 })}</button>
  </article>`;
}

// Variante en fila para pantallas de resultados/catálogo, con más
// información visible (compatibilidad, tienda, calificación) que el tile de
// las carruseles de Inicio. Comparte clase `product-card` para reutilizar
// bindProductCardEvents.
export function productListRow(product, store) {
  const pct = discountPercent(product);
  const isFav = favoritesService.isFavorite(product.id);
  const compat = compatibilityNote(product);
  return `
  <article class="product-card product-row" data-product-id="${product.id}" tabindex="0" role="button" aria-label="${escapeHtml(product.name)}">
    <div class="product-row__media">${productTile(product)}</div>
    <div class="product-row__body">
      <p class="product-row__name">${escapeHtml(product.name)}</p>
      ${compat || `<p class="product-row__compat">${escapeHtml(productService.compatibilityLabel(product))}</p>`}
      <div class="product-row__badges">
        ${availabilityBadge(product)}
        ${typeBadge(product.type)}
        ${pct ? discountBadge(pct) : ''}
      </div>
      ${store ? `
      <p class="product-row__store">
        ${escapeHtml(store.name)} ${icon('shieldCheck', { size: 12, className: 'store-check' })}
        <span class="dot-sep">·</span> ${ratingInline(store.rating)}
      </p>` : ''}
      <div class="product-row__price-row">
        <span class="product-card__price">${formatPrice(product.price)}</span>
        ${product.originalPrice ? `<span class="product-card__price-old">${formatPrice(product.originalPrice)}</span>` : ''}
      </div>
    </div>
    <div class="product-row__actions">
      <button type="button" class="icon-btn ${isFav ? 'is-active' : ''}" data-action="favorite" aria-label="Guardar en favoritos">${icon('heart', { size: 16 })}</button>
      <button type="button" class="btn-icon-primary" data-action="add-to-cart" aria-label="Agregar al carrito" ${product.availability === 'agotado' ? 'disabled' : ''}>${icon('cart', { size: 17 })}</button>
    </div>
  </article>`;
}

export function productListRowSkeleton() {
  return `
  <div class="product-card product-row product-row--skeleton" aria-hidden="true">
    <div class="skeleton product-row__media"></div>
    <div class="product-row__body">
      <div class="skeleton skeleton--text" style="width:80%"></div>
      <div class="skeleton skeleton--text" style="width:50%"></div>
      <div class="skeleton skeleton--text" style="width:35%"></div>
    </div>
  </div>`;
}

export function productCardSkeleton() {
  return `
  <div class="product-card product-card--skeleton" aria-hidden="true">
    <div class="skeleton product-card__media"></div>
    <div class="product-card__body">
      <div class="skeleton skeleton--text" style="width:85%"></div>
      <div class="skeleton skeleton--text" style="width:60%"></div>
      <div class="skeleton skeleton--text" style="width:40%"></div>
    </div>
  </div>`;
}

export function storeCard(store) {
  return `
  <article class="store-card" data-store-id="${store.id}" tabindex="0" role="button" aria-label="${escapeHtml(store.name)}">
    <div class="store-card__cover">${escapeHtml(store.initials)}</div>
    <div class="store-card__body">
      <div class="store-card__title-row">
        <p class="store-card__name">${escapeHtml(store.name)}</p>
        ${verifiedBadge({ compact: true })}
      </div>
      <p class="store-card__location">${icon('mapPin', { size: 13 })} ${escapeHtml(store.city)}</p>
      <div class="store-card__meta">
        ${ratingInline(store.rating, store.reviewsCount)}
        <span class="store-card__years">${store.yearsInRedAuto} años en RedAuto</span>
      </div>
    </div>
    ${icon('chevronRight', { size: 18, className: 'store-card__chevron' })}
  </article>`;
}

export function storeCardSkeleton() {
  return `
  <div class="store-card store-card--skeleton" aria-hidden="true">
    <div class="skeleton store-card__cover"></div>
    <div class="store-card__body">
      <div class="skeleton skeleton--text" style="width:70%"></div>
      <div class="skeleton skeleton--text" style="width:45%"></div>
      <div class="skeleton skeleton--text" style="width:55%"></div>
    </div>
  </div>`;
}

export function emptyState({ iconName = 'search', title, message, actionLabel, actionHref }) {
  return `
  <div class="empty-state">
    <div class="empty-state__icon">${icon(iconName, { size: 34 })}</div>
    <p class="empty-state__title">${title}</p>
    ${message ? `<p class="empty-state__message">${message}</p>` : ''}
    ${actionLabel ? `<a class="btn btn--primary" href="${actionHref || '#/'}">${actionLabel}</a>` : ''}
  </div>`;
}

export function sectionSkeletonGrid(count = 4, kind = 'product') {
  const item = kind === 'store' ? storeCardSkeleton : productCardSkeleton;
  return Array.from({ length: count }, item).join('');
}

const NAV_ITEMS = [
  { route: '/', label: 'Inicio', icon: 'home' },
  { route: '/buscar', label: 'Buscar', icon: 'search' },
  { route: '/carrito', label: 'Carrito', icon: 'cart', badgeId: 'nav-cart-count' },
  { route: '/tiendas', label: 'Tiendas', icon: 'store' },
  { route: '/perfil', label: 'Perfil', icon: 'user' },
];

export function bottomNavHtml(activeRoute) {
  const items = NAV_ITEMS.map((item) => {
    const isActive = activeRoute === item.route;
    return `
    <a href="#${item.route}" class="bottom-nav__item ${isActive ? 'is-active' : ''}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="bottom-nav__icon">
        ${icon(item.icon, { size: 22 })}
        ${item.badgeId ? `<span class="nav-badge" id="${item.badgeId}" hidden>0</span>` : ''}
      </span>
      <span class="bottom-nav__label">${item.label}</span>
    </a>`;
  }).join('');
  return `<nav class="bottom-nav" aria-label="Navegación principal">${items}</nav>`;
}

export function backHeaderHtml(title, { rightHtml = '' } = {}) {
  return `
  <header class="top-header top-header--detail">
    <a href="#" class="icon-btn" data-action="go-back" aria-label="Volver">${icon('chevronLeft', { size: 22 })}</a>
    <h1 class="top-header__title">${escapeHtml(title)}</h1>
    <div class="top-header__right">${rightHtml}</div>
  </header>`;
}

export function starRatingBig(rating) {
  return `<span class="rating rating--lg">${starGlyph(16, 'rating__icon')}${rating.toFixed(1)}</span>`;
}

// Fila de 5 estrellas para calificaciones (resumen y reseñas individuales).
export function miniStarsRow(rating) {
  const filled = Math.round(rating);
  return `<span class="mini-stars" aria-hidden="true">${Array.from({ length: 5 }, (_, i) =>
    starGlyph(12, i < filled ? 'mini-stars__on' : 'mini-stars__off')
  ).join('')}</span>`;
}

// Delegación de eventos compartida por toda tarjeta de producto (home,
// resultados de búsqueda, catálogo de tienda): agregar al carrito, marcar
// favorito y navegar al detalle. Se enlaza una sola vez por contenedor.
export function bindProductCardEvents(container) {
  container.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-action="favorite"]');
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = favBtn.closest('.product-card');
      const isFav = favoritesService.toggle(card.dataset.productId);
      favBtn.classList.toggle('is-active', isFav);
      showToast(isFav ? 'Guardado en favoritos' : 'Quitado de favoritos', 'info');
      return;
    }
    const addBtn = e.target.closest('[data-action="add-to-cart"]');
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = addBtn.closest('.product-card');
      cartService.addItem(card.dataset.productId, 1);
      showToast('Agregado al carrito', 'success');
      return;
    }
    const card = e.target.closest('.product-card');
    if (card) navigate(`/producto/${card.dataset.productId}`);
  });
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.product-card');
    if (card && e.target === card) {
      e.preventDefault();
      navigate(`/producto/${card.dataset.productId}`);
    }
  });
}

export function bindStoreCardEvents(container) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.store-card');
    if (card) navigate(`/tienda/${card.dataset.storeId}`);
  });
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.store-card');
    if (card && e.target === card) {
      e.preventDefault();
      navigate(`/tienda/${card.dataset.storeId}`);
    }
  });
}

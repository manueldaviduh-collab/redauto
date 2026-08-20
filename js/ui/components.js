import { icon } from './icons.js';
import { getCategoryById } from '../data/categories.js';
import { productService } from '../services/productService.js';
import { cartService } from '../services/cartService.js';
import { favoritesService } from '../services/favoritesService.js';
import { showToast } from './toast.js';
import { navigate } from '../nav.js';

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

const AVAILABILITY_LABEL = {
  en_stock: 'En stock',
  agotado: 'Agotado',
  bajo_pedido: 'Bajo pedido',
};

export function availabilityBadge(availability) {
  const modifier = availability === 'en_stock' ? 'ok' : availability === 'agotado' ? 'off' : 'wait';
  return `<span class="badge badge--${modifier}">${AVAILABILITY_LABEL[availability] || availability}</span>`;
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
  return `<span class="rating">${icon('star', { size: 13, className: 'rating__icon' })}${rating.toFixed(1)}${
    reviewsCount != null ? ` <span class="rating__count">(${reviewsCount})</span>` : ''
  }</span>`;
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
  return `<div class="product-tile product-tile--${product.categoryId}">${icon(category?.icon || 'package', { size: 30 })}</div>`;
}

export function productCard(product, store) {
  const pct = discountPercent(product);
  const isFav = favoritesService.isFavorite(product.id);
  return `
  <article class="product-card" data-product-id="${product.id}" tabindex="0" role="button" aria-label="${escapeHtml(product.name)}">
    <div class="product-card__media">
      ${productTile(product)}
      ${pct ? discountBadge(pct) : ''}
      <button type="button" class="icon-btn product-card__fav ${isFav ? 'is-active' : ''}" data-action="favorite" aria-label="Guardar en favoritos">${icon('heart', { size: 16 })}</button>
    </div>
    <div class="product-card__body">
      <p class="product-card__name">${escapeHtml(product.name)}</p>
      <p class="product-card__compat">${escapeHtml(productService.compatibilityLabel(product))}</p>
      <div class="product-card__price-row">
        <span class="product-card__price">${formatPrice(product.price)}</span>
        ${product.originalPrice ? `<span class="product-card__price-old">${formatPrice(product.originalPrice)}</span>` : ''}
      </div>
      <div class="product-card__meta">
        ${availabilityBadge(product.availability)}
        ${ratingInline(product.rating, product.reviewsCount)}
      </div>
      ${store ? `<p class="product-card__store">${escapeHtml(store.name)} ${icon('shieldCheck', { size: 12, className: 'store-check' })}</p>` : ''}
    </div>
    <button type="button" class="btn-icon-primary product-card__add" data-action="add-to-cart" aria-label="Agregar al carrito">${icon('cart', { size: 18 })}</button>
  </article>`;
}

// Variante en fila para pantallas de resultados/catálogo, con más
// información visible (compatibilidad, tienda, calificación) que el tile de
// las carruseles de Inicio. Comparte clase `product-card` para reutilizar
// bindProductCardEvents.
export function productListRow(product, store) {
  const pct = discountPercent(product);
  const isFav = favoritesService.isFavorite(product.id);
  return `
  <article class="product-card product-row" data-product-id="${product.id}" tabindex="0" role="button" aria-label="${escapeHtml(product.name)}">
    <div class="product-row__media">${productTile(product)}</div>
    <div class="product-row__body">
      <p class="product-row__name">${escapeHtml(product.name)}</p>
      <p class="product-row__compat">${escapeHtml(productService.compatibilityLabel(product))}</p>
      <div class="product-row__badges">
        ${availabilityBadge(product.availability)}
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
      <button type="button" class="btn-icon-primary" data-action="add-to-cart" aria-label="Agregar al carrito">${icon('cart', { size: 17 })}</button>
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
  return `<span class="rating rating--lg">${icon('star', { size: 16, className: 'rating__icon' })}${rating.toFixed(1)}</span>`;
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

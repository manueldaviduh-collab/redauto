import { icon, whatsappGlyph } from '../ui/icons.js';
import {
  productTile, availabilityBadge, typeBadge, verifiedBadge, starRatingBig, formatPrice,
  escapeHtml, backHeaderHtml, emptyState, compatibilityNote, whatsappLink, deliveryOptionsRow, miniStarsRow, ratingInline,
} from '../ui/components.js';
import { productService } from '../services/productService.js';
import { storeService } from '../services/storeService.js';
import { cartService } from '../services/cartService.js';
import { favoritesService } from '../services/favoritesService.js';
import { sampleReviewsFor } from '../data/reviews.js';
import { showToast } from '../ui/toast.js';
import { navigate } from '../nav.js';

export async function render(container, { segments }) {
  const id = segments[1];
  container.innerHTML = `<div class="screen-loading">${backHeaderHtml('Producto')}<div class="skeleton skeleton--hero"></div></div>`;

  const product = await productService.getById(id);
  if (!product) {
    container.innerHTML = `
      ${backHeaderHtml('Producto no encontrado')}
      <div class="screen-pad">${emptyState({ iconName: 'info', title: 'Este producto ya no está disponible', actionLabel: 'Volver al inicio', actionHref: '#/' })}</div>
    `;
    bindBack(container);
    return;
  }
  const store = await storeService.getById(product.storeId);
  const isFav = favoritesService.isFavorite(product.id);
  const showDiscount = product.originalPrice && product.originalPrice > product.price;
  const reviews = sampleReviewsFor(product);
  container.classList.add('screen-content--with-sticky-actions');

  container.innerHTML = `
    ${backHeaderHtml('Detalle del producto', {
      rightHtml: `
        <button type="button" class="icon-btn" id="btn-share" aria-label="Compartir">${icon('share', { size: 19 })}</button>
        <button type="button" class="icon-btn ${isFav ? 'is-active' : ''}" id="btn-fav" aria-label="Guardar en favoritos">${icon('heart', { size: 19 })}</button>
      `,
    })}
    <div class="screen-pad product-detail">
      <div class="product-detail__media">${productTile(product)}</div>

      <h1 class="product-detail__name">${escapeHtml(product.name)}</h1>
      <p class="product-detail__brand">${escapeHtml(product.partBrand)} · SKU ${escapeHtml(product.sku)}</p>

      <div class="product-detail__meta-row">
        ${starRatingBig(product.rating)}
        <span class="rating__count">(${product.reviewsCount} reseñas)</span>
      </div>

      <div class="product-detail__price-row">
        <span class="product-detail__price">${formatPrice(product.price)}</span>
        ${showDiscount ? `<span class="product-card__price-old">${formatPrice(product.originalPrice)}</span>` : ''}
      </div>

      <div class="product-detail__badges">
        ${availabilityBadge(product)}
        ${typeBadge(product.type)}
      </div>

      ${compatibilityNote(product, { variant: 'banner' }) || ''}

      <section class="detail-block">
        <h2 class="detail-block__title">Descripción</h2>
        <p class="detail-block__text">${escapeHtml(product.description)}</p>
      </section>

      <section class="detail-block">
        <h2 class="detail-block__title">Compatibilidad</h2>
        <ul class="compat-list">
          ${product.compatibility.map((c) => `<li>${c.brand === 'Universal' ? escapeHtml(c.model) : `${escapeHtml(c.brand)} ${escapeHtml(c.model)} · ${c.yearFrom}-${c.yearTo}`}</li>`).join('')}
        </ul>
      </section>

      ${store ? `
      <section class="detail-block store-strip" data-store-id="${store.id}" role="button" tabindex="0">
        <div class="store-strip__cover">${escapeHtml(store.initials)}</div>
        <div class="store-strip__info">
          <p class="store-strip__name">${escapeHtml(store.name)} ${verifiedBadge({ compact: true })}</p>
          <p class="store-strip__meta">${escapeHtml(store.city)} <span class="dot-sep">·</span> ${ratingInline(store.rating)}</p>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="btn-view-store">Ver tienda</button>
      </section>
      <div class="store-cta-row">
        <a class="btn btn--whatsapp" href="${whatsappLink(store.phone, `Hola ${store.name}, vi el producto "${product.name}" en RedAuto y quisiera más información.`)}" target="_blank" rel="noopener">${whatsappGlyph({ size: 18 })} Contactar por WhatsApp</a>
      </div>
      ${deliveryOptionsRow(store.deliveryOptions)}` : ''}

      <section class="detail-block">
        <h2 class="detail-block__title">Cantidad</h2>
        <div class="qty-stepper" id="qty-stepper">
          <button type="button" class="qty-stepper__btn" data-step="-1" aria-label="Disminuir cantidad">${icon('minus', { size: 16 })}</button>
          <span class="qty-stepper__value" id="qty-value">1</span>
          <button type="button" class="qty-stepper__btn" data-step="1" aria-label="Aumentar cantidad">${icon('plus', { size: 16 })}</button>
        </div>
      </section>

      <section class="detail-block">
        <h2 class="detail-block__title">Reseñas</h2>
        <div class="reviews-summary">
          <span class="reviews-summary__score">${product.rating.toFixed(1)}</span>
          <div>
            ${miniStarsRow(product.rating)}
            <p class="reviews-summary__count">${product.reviewsCount} reseñas</p>
          </div>
        </div>
        ${reviews.length ? `<div class="review-list">${reviews.map(reviewRow).join('')}</div>` : ''}
      </section>
    </div>

    <div class="sticky-actions">
      <button type="button" class="btn btn--outline" id="btn-add-cart">${icon('cart', { size: 18 })} Agregar al carrito</button>
      <button type="button" class="btn btn--primary" id="btn-buy-now" ${product.availability === 'agotado' ? 'disabled' : ''}>Comprar ahora</button>
    </div>
  `;

  bindBack(container);
  bindActions(container, product, store);
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : navigate('/');
  });
}

function bindActions(container, product, store) {
  let qty = 1;
  const qtyValue = container.querySelector('#qty-value');
  const maxQty = product.availability === 'agotado' ? 0 : Math.max(product.stock, 1);

  container.querySelector('#qty-stepper')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    qty = Math.min(Math.max(1, qty + Number(btn.dataset.step)), maxQty || 99);
    qtyValue.textContent = String(qty);
  });

  container.querySelector('#btn-fav')?.addEventListener('click', (e) => {
    const isFav = favoritesService.toggle(product.id);
    e.currentTarget.classList.toggle('is-active', isFav);
    showToast(isFav ? 'Guardado en favoritos' : 'Quitado de favoritos', 'info');
  });

  container.querySelector('#btn-share')?.addEventListener('click', async () => {
    const url = location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch (_) { /* cancelado por el usuario */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast('Enlace copiado al portapapeles', 'info');
    }
  });

  const storeStrip = container.querySelector('.store-strip');
  const goToStore = () => navigate(`/tienda/${product.storeId}`);
  storeStrip?.addEventListener('click', goToStore);
  container.querySelector('#btn-view-store')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goToStore();
  });

  container.querySelector('#btn-add-cart')?.addEventListener('click', () => {
    cartService.addItem(product.id, qty);
    showToast('Agregado al carrito', 'success');
  });

  container.querySelector('#btn-buy-now')?.addEventListener('click', () => {
    cartService.addItem(product.id, qty);
    navigate('/checkout');
  });
}

function reviewRow(r) {
  return `
  <article class="review-row">
    <div class="review-row__head">
      <span class="review-row__author">${escapeHtml(r.author)}</span>
      ${miniStarsRow(r.rating)}
    </div>
    <p class="review-row__comment">${escapeHtml(r.comment)}</p>
    <p class="review-row__time">Hace ${r.daysAgo} días</p>
  </article>`;
}

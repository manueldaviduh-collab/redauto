import { icon, whatsappGlyph } from '../ui/icons.js';
import {
  backHeaderHtml, verifiedBadge, starRatingBig, productListRow, sectionSkeletonGrid,
  escapeHtml, bindProductCardEvents, emptyState, whatsappLink, deliveryOptionsRow,
} from '../ui/components.js';
import { storeService } from '../services/storeService.js';
import { productService } from '../services/productService.js';
import { favoritesService } from '../services/favoritesService.js';
import { getCategoryById } from '../data/categories.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';
import { openStoreChat } from '../ui/chat.js';

export async function render(container, { segments }) {
  const id = segments[1];
  container.innerHTML = `${backHeaderHtml('Tienda')}<div class="screen-pad"><div class="skeleton skeleton--hero"></div></div>`;

  const store = await storeService.getById(id);
  if (!store) {
    container.innerHTML = `
      ${backHeaderHtml('Tienda no encontrada')}
      <div class="screen-pad">${emptyState({ iconName: 'store', title: 'Esta tienda ya no está disponible', actionLabel: 'Ver todas las tiendas', actionHref: '#/tiendas' })}</div>
    `;
    bindBack(container);
    return;
  }

  const isFavStore = favoritesService.stores.isFavorite(store.id);

  container.innerHTML = `
    ${backHeaderHtml(store.name, {
      rightHtml: `
        <button type="button" class="icon-btn" id="btn-share-store" aria-label="Compartir tienda">${icon('share', { size: 19 })}</button>
        <button type="button" class="icon-btn ${isFavStore ? 'is-active' : ''}" id="btn-fav-store" aria-label="Guardar tienda en favoritos">${icon('heart', { size: 19 })}</button>
      `,
    })}
    <div class="store-cover">
      ${store.logoUrl
        ? `<img class="store-cover__logo" src="${escapeHtml(store.logoUrl)}" alt="" loading="lazy" />`
        : `<span class="store-cover__initials">${escapeHtml(store.initials)}</span>`}
    </div>
    <div class="screen-pad">
      <div class="store-header-row">
        <div>
          <h1 class="store-title">${escapeHtml(store.name)}</h1>
          <p class="store-subtitle">${icon('mapPin', { size: 14 })} ${escapeHtml(store.city)} · ${store.yearsInRedAuto} años en RedAuto</p>
        </div>
        ${verifiedBadge()}
      </div>

      <div class="stat-row">
        <div class="stat-card"><span class="stat-card__value">${starRatingBig(store.rating)}</span><span class="stat-card__label">${store.reviewsCount} reseñas</span></div>
        <div class="stat-card"><span class="stat-card__value">${store.onTimeDeliveryPct}%</span><span class="stat-card__label">Entregas a tiempo</span></div>
        <div class="stat-card"><span class="stat-card__value">+${store.salesCount}</span><span class="stat-card__label">Ventas</span></div>
      </div>

      <div class="store-info-strip">
        <span>${icon('clock', { size: 14 })} ${escapeHtml(store.hours)}</span>
        <span>${icon('trendUp', { size: 14 })} ${escapeHtml(store.responseTime)}</span>
      </div>

      <section class="detail-block">
        <h2 class="detail-block__title">Sobre la tienda</h2>
        <p class="detail-block__text">${escapeHtml(store.about)}</p>
      </section>

      <section class="detail-block">
        <h2 class="detail-block__title">Entrega</h2>
        <p class="detail-block__text">${icon('truck', { size: 15 })} ${escapeHtml(store.delivery.shipping)}</p>
        ${store.delivery.pickup ? `<p class="detail-block__text">${icon('mapPin', { size: 15 })} Retiro en tienda disponible en ${escapeHtml(store.address)}</p>` : ''}
        ${deliveryOptionsRow(store.deliveryOptions)}
      </section>

      <section class="detail-block">
        <h2 class="detail-block__title">Categorías</h2>
        <div class="chip-row">
          ${store.categories.map((cid) => {
            const cat = getCategoryById(cid);
            return cat ? `<span class="chip">${icon(cat.icon, { size: 14 })} ${cat.name}</span>` : '';
          }).join('')}
        </div>
      </section>

      <button type="button" class="btn btn--primary btn--block" data-scroll-to="store-catalog">Ver catálogo</button>
      <button type="button" class="btn btn--outline btn--block" id="btn-ask-store">${icon('message', { size: 16 })} Preguntar a la tienda</button>
      <div class="contact-secondary-row">
        <span>¿Prefieres hablar directo?</span>
        <a href="${whatsappLink(store.phone, `Hola ${store.name}, vi su tienda en RedAuto y quisiera hacer una consulta.`)}" target="_blank" rel="noopener">${whatsappGlyph({ size: 13 })} WhatsApp</a>
        <a href="tel:${store.phone.replace(/\s|-/g, '')}">${icon('phone', { size: 13 })} Llamar</a>
      </div>

      <section class="detail-block" id="store-catalog">
        <h2 class="detail-block__title">Catálogo (${escapeHtml(store.name)})</h2>
        <div class="product-list" id="store-products">${sectionSkeletonGrid(3, 'product')}</div>
      </section>
    </div>
  `;

  bindBack(container);
  container.querySelector('[data-scroll-to]')?.addEventListener('click', (e) => {
    document.getElementById(e.currentTarget.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  container.querySelector('#btn-ask-store')?.addEventListener('click', () => openStoreChat({ store }));
  container.querySelector('#btn-fav-store')?.addEventListener('click', (e) => {
    const isFav = favoritesService.stores.toggle(store.id);
    e.currentTarget.classList.toggle('is-active', isFav);
    showToast(isFav ? 'Tienda guardada en favoritos' : 'Tienda quitada de favoritos', 'info');
  });
  container.querySelector('#btn-share-store')?.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: store.name, url: location.href }); } catch (_) {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(location.href);
      showToast('Enlace copiado al portapapeles', 'info');
    }
  });

  const [products] = await Promise.all([productService.getByStore(store.id)]);
  const listEl = container.querySelector('#store-products');
  if (!listEl) return;
  if (!products.length) {
    listEl.innerHTML = emptyState({ iconName: 'package', title: 'Esta tienda aún no publica productos' });
    return;
  }
  listEl.innerHTML = products.map((p) => productListRow(p, store)).join('');
  bindProductCardEvents(listEl);
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : navigate('/tiendas');
  });
}

import { icon } from '../ui/icons.js';
import {
  productCard, storeCard, sectionSkeletonGrid, escapeHtml, bindProductCardEvents, bindStoreCardEvents,
} from '../ui/components.js';
import { productService } from '../services/productService.js';
import { storeService } from '../services/storeService.js';
import { vehicleService } from '../services/vehicleService.js';
import { cartService } from '../services/cartService.js';
import { getItem, setItem } from '../services/storage.js';
import { navigate } from '../nav.js';
import { openModal, closeModal } from '../ui/modal.js';
import { categories } from '../data/categories.js';

const CITIES = ['Caracas', 'Valencia', 'Maracaibo', 'Barquisimeto', 'Maracay', 'Barcelona'];
const NOTIFICATIONS = [
  { title: 'Tu pedido #ord-1002 va en camino', time: 'Hace 2 h' },
  { title: 'Nueva oferta en pastillas de freno', time: 'Hoy' },
  { title: 'Bienvenido a RedAuto', time: 'Ayer' },
];

export async function render(container) {
  const city = getItem('city_pref', 'Caracas');
  const vehicle = vehicleService.getPreferred() || {};
  const brands = vehicleService.getBrands();

  container.innerHTML = `
    <header class="top-header top-header--home">
      <div class="brand-lockup">
        <img class="brand-mark" src="assets/logo-mark.png" alt="RedAuto" />
        <span class="brand-word">Red<span class="accent">Auto</span></span>
      </div>
      <div class="top-header__actions">
        <button type="button" class="icon-btn" id="btn-bell" aria-label="Notificaciones">
          ${icon('bell', { size: 21 })}<span class="dot-badge" aria-hidden="true"></span>
        </button>
        <button type="button" class="icon-btn" id="btn-cart" aria-label="Ir al carrito">
          ${icon('cart', { size: 21 })}<span class="nav-badge" id="home-cart-count" hidden>0</span>
        </button>
      </div>
    </header>

    <div class="screen-pad">
      <button type="button" class="location-chip" id="btn-location">
        ${icon('mapPin', { size: 15 })}
        <span>${escapeHtml(city)}, Venezuela</span>
        ${icon('chevronRight', { size: 14, className: 'location-chip__chevron' })}
      </button>

      <p class="trust-line">Repuestos originales y alternativos de tiendas verificadas, listos para tu carro.</p>

      <form class="search-bar" id="home-search-form" role="search">
        <span class="search-bar__icon">${icon('search', { size: 18 })}</span>
        <input type="search" id="home-search-input" placeholder="Buscar repuestos, marcas, piezas…" aria-label="Buscar repuestos" />
      </form>

      <section class="vehicle-picker" aria-label="Selecciona tu vehículo">
        <select id="veh-brand" aria-label="Marca">
          <option value="">Marca</option>
          ${brands.map((b) => `<option value="${b}" ${vehicle.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
        <select id="veh-model" aria-label="Modelo">
          <option value="">Modelo</option>
          ${(vehicleService.getModels(vehicle.brand) || []).map((m) => `<option value="${m}" ${vehicle.model === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <select id="veh-year" aria-label="Año">
          <option value="">Año</option>
          ${vehicleService.getYears().map((y) => `<option value="${y}" ${String(vehicle.year) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </section>
      <button type="button" class="btn btn--primary btn--block" id="btn-vehicle-search">Buscar repuestos para mi auto</button>

      <section class="section" aria-label="Categorías">
        <div class="section__head">
          <h2 class="section__title">Categorías</h2>
          <a href="#/buscar" class="section__link">Ver todas</a>
        </div>
        <div class="category-grid">
          ${categories.map((c) => `
            <button type="button" class="category-tile" data-category="${c.id}">
              <span class="category-tile__icon">${icon(c.icon, { size: 22 })}</span>
              <span class="category-tile__label">${c.name}</span>
            </button>`).join('')}
        </div>
      </section>

      <section class="section" aria-label="Productos destacados">
        <div class="section__head">
          <h2 class="section__title">Productos destacados</h2>
          <a href="#/buscar" class="section__link">Ver todos</a>
        </div>
        <div class="h-scroll" id="featured-products">${sectionSkeletonGrid(4, 'product')}</div>
      </section>

      <section class="section" aria-label="Tiendas verificadas">
        <div class="section__head">
          <h2 class="section__title">Tiendas verificadas</h2>
          <a href="#/tiendas" class="section__link">Ver todas</a>
        </div>
        <div class="h-scroll" id="featured-stores">${sectionSkeletonGrid(3, 'store')}</div>
      </section>
    </div>
  `;

  bindHeader(container, city);
  bindSearch(container);
  bindVehiclePicker(container);
  bindCategories(container);
  updateCartBadge();
  window.addEventListener('redauto:cart-changed', updateCartBadge);

  const [featured, stores] = await Promise.all([
    productService.getFeatured(8),
    storeService.getAll(),
  ]);

  const productsHost = container.querySelector('#featured-products');
  if (productsHost) {
    productsHost.innerHTML = featured.map((p) => productCard(p)).join('');
    bindProductCardEvents(productsHost);
  }

  const storesHost = container.querySelector('#featured-stores');
  if (storesHost) {
    storesHost.innerHTML = stores.slice(0, 5).map((s) => storeCard(s)).join('');
    bindStoreCardEvents(storesHost);
  }

  function updateCartBadge() {
    const count = cartService.getRawCount();
    const badge = container.querySelector('#home-cart-count');
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
  }
}

function bindHeader(container, city) {
  container.querySelector('#btn-cart')?.addEventListener('click', () => navigate('/carrito'));
  container.querySelector('#btn-location')?.addEventListener('click', () => {
    openModal({
      title: 'Selecciona tu ciudad',
      bodyHtml: `<div class="option-list">${CITIES.map((c) => `<button type="button" class="option-list__item" data-city="${c}">${c}, Venezuela</button>`).join('')}</div>`,
      onMount: (body) => {
        body.querySelectorAll('[data-city]').forEach((btn) => {
          btn.addEventListener('click', () => {
            setItem('city_pref', btn.dataset.city);
            closeModal();
            navigate('/');
          });
        });
      },
    });
  });
  container.querySelector('#btn-bell')?.addEventListener('click', () => {
    openModal({
      title: 'Notificaciones',
      bodyHtml: `<div class="notif-list">${NOTIFICATIONS.map((n) => `
        <div class="notif-list__item">
          <p class="notif-list__title">${escapeHtml(n.title)}</p>
          <p class="notif-list__time">${n.time}</p>
        </div>`).join('')}</div>`,
    });
  });
}

function bindSearch(container) {
  const form = container.querySelector('#home-search-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = container.querySelector('#home-search-input').value.trim();
    navigate(`/buscar${value ? `?q=${encodeURIComponent(value)}` : ''}`);
  });
}

function bindVehiclePicker(container) {
  const brandEl = container.querySelector('#veh-brand');
  const modelEl = container.querySelector('#veh-model');
  const yearEl = container.querySelector('#veh-year');

  brandEl.addEventListener('change', () => {
    const models = vehicleService.getModels(brandEl.value);
    modelEl.innerHTML = `<option value="">Modelo</option>${models.map((m) => `<option value="${m}">${m}</option>`).join('')}`;
  });

  container.querySelector('#btn-vehicle-search')?.addEventListener('click', () => {
    const vehicle = { brand: brandEl.value, model: modelEl.value, year: yearEl.value };
    vehicleService.setPreferred(vehicle.brand ? vehicle : null);
    const params = new URLSearchParams();
    if (vehicle.brand) params.set('brand', vehicle.brand);
    if (vehicle.model) params.set('model', vehicle.model);
    if (vehicle.year) params.set('year', vehicle.year);
    navigate(`/buscar${params.toString() ? `?${params.toString()}` : ''}`);
  });
}

function bindCategories(container) {
  container.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(`/buscar?categoryId=${btn.dataset.category}`));
  });
}

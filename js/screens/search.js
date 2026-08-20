import { icon } from '../ui/icons.js';
import {
  productListRow, productListRowSkeleton, emptyState, escapeHtml, bindProductCardEvents,
} from '../ui/components.js';
import { productService } from '../services/productService.js';
import { storeService } from '../services/storeService.js';
import { categoryService } from '../services/categoryService.js';
import { vehicleService } from '../services/vehicleService.js';
import { navigate } from '../nav.js';
import { openModal, closeModal } from '../ui/modal.js';

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: 'en_stock', label: 'En stock' },
  { value: 'bajo_pedido', label: 'Bajo pedido' },
  { value: 'agotado', label: 'Agotado' },
];
const TYPE_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: 'original', label: 'Original' },
  { value: 'alternativo', label: 'Alternativo' },
];

// Estado de filtros vive en memoria del módulo (se reconstruye desde la URL
// en cada render, así que `#/buscar?...` sigue siendo la fuente de verdad
// compartible/enlazable).
export async function render(container, { query }) {
  const filters = {
    query: query.q || '',
    brand: query.brand || '',
    model: query.model || '',
    year: query.year || '',
    categoryId: query.categoryId || '',
    availability: query.availability || '',
    type: query.type || '',
    minPrice: query.minPrice || '',
    maxPrice: query.maxPrice || '',
  };

  const categories = await categoryService.getAll();
  const activeCategory = categories.find((c) => c.id === filters.categoryId);

  container.innerHTML = `
    <header class="top-header">
      <h1 class="top-header__title">Buscar repuestos</h1>
    </header>
    <div class="screen-pad">
      <form class="search-bar" id="search-form" role="search">
        <span class="search-bar__icon">${icon('search', { size: 18 })}</span>
        <input type="search" id="search-input" placeholder="Buscar repuestos, marcas, piezas…" value="${escapeHtml(filters.query)}" aria-label="Buscar repuestos" />
      </form>

      <div class="chip-row">
        <button type="button" class="chip chip--action" id="btn-open-filters">
          ${icon('filter', { size: 15 })} Filtros
        </button>
        ${filters.brand ? `<span class="chip">${escapeHtml([filters.brand, filters.model, filters.year].filter(Boolean).join(' '))} <button type="button" data-clear="vehicle" aria-label="Quitar filtro de vehículo">${icon('x', { size: 12 })}</button></span>` : ''}
        ${activeCategory ? `<span class="chip">${activeCategory.name} <button type="button" data-clear="categoryId" aria-label="Quitar filtro de categoría">${icon('x', { size: 12 })}</button></span>` : ''}
        ${filters.availability ? `<span class="chip">${AVAILABILITY_OPTIONS.find((o) => o.value === filters.availability)?.label} <button type="button" data-clear="availability" aria-label="Quitar filtro de disponibilidad">${icon('x', { size: 12 })}</button></span>` : ''}
        ${filters.type ? `<span class="chip">${TYPE_OPTIONS.find((o) => o.value === filters.type)?.label} <button type="button" data-clear="type" aria-label="Quitar filtro de tipo">${icon('x', { size: 12 })}</button></span>` : ''}
      </div>

      <p class="results-count" id="results-count">Buscando…</p>
      <div class="product-list" id="results-list">${Array.from({ length: 4 }, productListRowSkeleton).join('')}</div>
    </div>
  `;

  bindSearchForm(container, filters);
  bindClearChips(container, filters);
  container.querySelector('#btn-open-filters')?.addEventListener('click', () => openFiltersSheet(filters));

  const [results, stores] = await Promise.all([
    productService.search(filters),
    storeService.getAll(),
  ]);
  const storeMap = new Map(stores.map((s) => [s.id, s]));

  const countEl = container.querySelector('#results-count');
  const listEl = container.querySelector('#results-list');
  if (!listEl) return;

  if (!results.length) {
    countEl.textContent = 'Sin resultados';
    listEl.innerHTML = emptyState({
      iconName: 'search',
      title: 'No encontramos repuestos con esos filtros',
      message: 'Intenta con otra palabra clave, quita algún filtro o revisa la compatibilidad del vehículo.',
      actionLabel: 'Limpiar filtros',
      actionHref: '#/buscar',
    });
    return;
  }

  countEl.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'}`;
  listEl.innerHTML = results.map((p) => productListRow(p, storeMap.get(p.storeId))).join('');
  bindProductCardEvents(listEl);
}

function applyFilters(next) {
  const params = new URLSearchParams();
  Object.entries(next).forEach(([key, value]) => {
    if (value) params.set(key === 'query' ? 'q' : key, value);
  });
  navigate(`/buscar${params.toString() ? `?${params.toString()}` : ''}`);
}

function bindSearchForm(container, filters) {
  container.querySelector('#search-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = container.querySelector('#search-input').value.trim();
    applyFilters({ ...filters, query: value });
  });
}

function bindClearChips(container, filters) {
  container.querySelectorAll('[data-clear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.clear;
      const next = { ...filters };
      if (key === 'vehicle') {
        next.brand = '';
        next.model = '';
        next.year = '';
        vehicleService.clearPreferred();
      } else {
        next[key] = '';
      }
      applyFilters(next);
    });
  });
}

function openFiltersSheet(filters) {
  const brands = vehicleService.getBrands();
  const models = vehicleService.getModels(filters.brand);

  openModal({
    title: 'Filtros de búsqueda',
    bodyHtml: `
      <form id="filters-form" class="filters-form">
        <fieldset class="filters-form__group">
          <legend>Vehículo</legend>
          <div class="filters-form__row">
            <select name="brand" aria-label="Marca">
              <option value="">Marca</option>
              ${brands.map((b) => `<option value="${b}" ${filters.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
            <select name="model" id="filter-model" aria-label="Modelo">
              <option value="">Modelo</option>
              ${models.map((m) => `<option value="${m}" ${filters.model === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
            <select name="year" aria-label="Año">
              <option value="">Año</option>
              ${vehicleService.getYears().map((y) => `<option value="${y}" ${String(filters.year) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </fieldset>

        <fieldset class="filters-form__group">
          <legend>Categoría</legend>
          <select name="categoryId" aria-label="Categoría">
            <option value="">Todas las categorías</option>
          </select>
        </fieldset>

        <fieldset class="filters-form__group">
          <legend>Disponibilidad</legend>
          <div class="filters-form__pills" data-pills="availability">
            ${AVAILABILITY_OPTIONS.map((o) => `<button type="button" class="pill ${filters.availability === o.value ? 'is-selected' : ''}" data-value="${o.value}">${o.label}</button>`).join('')}
          </div>
        </fieldset>

        <fieldset class="filters-form__group">
          <legend>Tipo de repuesto</legend>
          <div class="filters-form__pills" data-pills="type">
            ${TYPE_OPTIONS.map((o) => `<button type="button" class="pill ${filters.type === o.value ? 'is-selected' : ''}" data-value="${o.value}">${o.label}</button>`).join('')}
          </div>
        </fieldset>

        <fieldset class="filters-form__group">
          <legend>Precio (USD)</legend>
          <div class="filters-form__row">
            <input type="number" min="0" name="minPrice" placeholder="Mínimo" value="${filters.minPrice}" aria-label="Precio mínimo" />
            <input type="number" min="0" name="maxPrice" placeholder="Máximo" value="${filters.maxPrice}" aria-label="Precio máximo" />
          </div>
        </fieldset>

        <div class="filters-form__actions">
          <button type="button" class="btn btn--ghost" id="btn-clear-filters">Limpiar</button>
          <button type="submit" class="btn btn--primary">Aplicar filtros</button>
        </div>
      </form>
    `,
    onMount: async (body) => {
      const categories = await categoryService.getAll();
      const categorySelect = body.querySelector('[name="categoryId"]');
      categorySelect.innerHTML += categories
        .map((c) => `<option value="${c.id}" ${filters.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`)
        .join('');

      body.querySelector('[name="brand"]').addEventListener('change', (e) => {
        const modelSelect = body.querySelector('#filter-model');
        const opts = vehicleService.getModels(e.target.value);
        modelSelect.innerHTML = `<option value="">Modelo</option>${opts.map((m) => `<option value="${m}">${m}</option>`).join('')}`;
      });

      body.querySelectorAll('[data-pills]').forEach((group) => {
        group.addEventListener('click', (e) => {
          const btn = e.target.closest('.pill');
          if (!btn) return;
          group.querySelectorAll('.pill').forEach((p) => p.classList.remove('is-selected'));
          btn.classList.add('is-selected');
        });
      });

      body.querySelector('#btn-clear-filters').addEventListener('click', () => {
        closeModal();
        applyFilters({ query: filters.query });
      });

      body.querySelector('#filters-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const data = new FormData(form);
        const availability = body.querySelector('[data-pills="availability"] .is-selected')?.dataset.value || '';
        const type = body.querySelector('[data-pills="type"] .is-selected')?.dataset.value || '';
        const next = {
          ...filters,
          brand: data.get('brand') || '',
          model: data.get('model') || '',
          year: data.get('year') || '',
          categoryId: data.get('categoryId') || '',
          availability,
          type,
          minPrice: data.get('minPrice') || '',
          maxPrice: data.get('maxPrice') || '',
        };
        if (next.brand) vehicleService.setPreferred({ brand: next.brand, model: next.model, year: next.year });
        closeModal();
        applyFilters(next);
      });
    },
  });
}

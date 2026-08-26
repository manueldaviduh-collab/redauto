import { icon } from '../ui/icons.js';
import {
  backHeaderHtml, escapeHtml, formatPrice, availabilityBadge, typeBadge, emptyState, ratingInline,
} from '../ui/components.js';
import { authService } from '../services/authService.js';
import { sellerService } from '../services/sellerService.js';
import { categories } from '../data/categories.js';
import { navigate } from '../nav.js';
import { openModal, closeModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: 'barChart' },
  { id: 'pedidos', label: 'Pedidos', icon: 'clipboardList' },
  { id: 'inventario', label: 'Inventario', icon: 'package' },
  { id: 'verificacion', label: 'Verificación', icon: 'shieldCheck' },
];

export async function render(container) {
  const user = authService.getCurrentUser();

  if (!user || user.role !== 'vendedor') {
    container.innerHTML = `
      ${backHeaderHtml('Panel de vendedor')}
      <div class="screen-pad">
        ${emptyState({
          iconName: 'store',
          title: 'Esta sección es solo para tiendas verificadas',
          message: 'Inicia sesión con una cuenta de vendedor para gestionar tu tienda en RedAuto.',
          actionLabel: 'Volver a mi perfil',
          actionHref: '#/perfil',
        })}
      </div>
    `;
    bindBack(container);
    return;
  }

  container.innerHTML = `${backHeaderHtml('Panel de vendedor')}<div class="screen-pad"><div class="skeleton skeleton--hero"></div></div>`;
  bindBack(container);

  let dashboard;
  try {
    dashboard = await sellerService.getDashboard(user.storeId);
  } catch (err) {
    container.innerHTML = `
      ${backHeaderHtml('Panel de vendedor')}
      <div class="screen-pad">
        ${emptyState({
          iconName: 'info',
          title: 'No se pudo conectar con el servidor',
          message: err?.message || 'Verifica tu conexión o que el backend de RedAuto esté encendido, y vuelve a intentar.',
          actionLabel: 'Reintentar',
          actionHref: '#/vendedor',
        })}
      </div>
    `;
    bindBack(container);
    return;
  }
  let activeTab = 'resumen';

  container.innerHTML = `
    ${backHeaderHtml('Panel de vendedor')}
    <div class="screen-pad seller-panel">
      <p class="seller-panel__store">${escapeHtml(dashboard.store?.name || '')} · ${escapeHtml(dashboard.store?.city || '')}</p>
      <div class="tab-bar" id="seller-tabs" role="tablist">
        ${TABS.map((t) => `
          <button type="button" class="tab-bar__item ${t.id === activeTab ? 'is-active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${t.id === activeTab}">
            ${icon(t.icon, { size: 16 })} ${t.label}
          </button>`).join('')}
      </div>
      <div id="seller-tab-content"></div>
    </div>
  `;
  bindBack(container);

  const tabsEl = container.querySelector('#seller-tabs');
  const contentEl = container.querySelector('#seller-tab-content');

  function paint() {
    tabsEl.querySelectorAll('[data-tab]').forEach((btn) => {
      const isActive = btn.dataset.tab === activeTab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    contentEl.innerHTML = renderTab(activeTab, dashboard, user);
    bindTabEvents(contentEl, activeTab, user, dashboard, async () => {
      const fresh = await sellerService.getDashboard(user.storeId);
      Object.assign(dashboard, fresh);
      paint();
    });
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    paint();
  });

  paint();
}

function renderTab(tab, dashboard, user) {
  if (tab === 'resumen') return renderResumen(dashboard);
  if (tab === 'pedidos') return renderPedidos(dashboard);
  if (tab === 'inventario') return renderInventario(dashboard);
  return renderVerificacion(dashboard);
}

function renderResumen({ kpis }) {
  return `
  <div class="kpi-grid">
    <div class="kpi-card"><span class="kpi-card__value">${formatPrice(kpis.totalSales)}</span><span class="kpi-card__label">Ventas totales</span></div>
    <div class="kpi-card"><span class="kpi-card__value">${kpis.ordersCount}</span><span class="kpi-card__label">Pedidos</span></div>
    <div class="kpi-card"><span class="kpi-card__value">${kpis.pendingOrders}</span><span class="kpi-card__label">Pendientes</span></div>
    <div class="kpi-card"><span class="kpi-card__value">${kpis.productsCount}</span><span class="kpi-card__label">Productos</span></div>
    <div class="kpi-card"><span class="kpi-card__value">${ratingInline(kpis.rating)}</span><span class="kpi-card__label">Calificación</span></div>
  </div>
  <p class="detail-block__text seller-note">${icon('info', { size: 14 })} Tu inventario y tu tienda son datos reales guardados en el servidor. Los pedidos todavía se calculan sobre datos de ejemplo — el checkout real de compradores es un paso posterior (ver docs/ROADMAP.md).</p>
  `;
}

function renderPedidos({ orders }) {
  if (!orders.length) return emptyState({ iconName: 'clipboardList', title: 'Aún no tienes pedidos' });
  return `
  <div class="order-list">
    ${orders.map((o) => `
      <article class="order-row">
        <div>
          <p class="order-row__id">#${o.id}</p>
          <p class="order-row__date">${o.date} · ${o.items.map((i) => escapeHtml(i.product?.name || '')).join(', ')}</p>
        </div>
        <div class="order-row__side">
          <span class="badge badge--wait">${o.status}</span>
          <span class="order-row__total">${formatPrice(o.total)}</span>
        </div>
      </article>`).join('')}
  </div>`;
}

function renderInventario({ products }) {
  return `
  <button type="button" class="btn btn--primary btn--block" id="btn-add-product">${icon('plusCircle', { size: 17 })} Agregar producto</button>
  <div class="inventory-list">
    ${products.length ? products.map((p) => `
      <article class="inventory-row" data-product-id="${p.id}">
        <div class="inventory-row__body">
          <p class="inventory-row__name">${escapeHtml(p.name)}</p>
          <div class="inventory-row__meta">
            ${availabilityBadge(p)}
            ${typeBadge(p.type)}
            <span>${formatPrice(p.price)}</span>
          </div>
        </div>
        <button type="button" class="icon-btn" data-edit="${p.id}" aria-label="Editar producto">${icon('edit', { size: 17 })}</button>
      </article>`).join('') : emptyState({ iconName: 'package', title: 'Aún no tienes productos publicados' })}
  </div>`;
}

function renderVerificacion({ store }) {
  return `
  <div class="verification-card">
    <div class="verification-card__icon">${icon('shieldCheck', { size: 26 })}</div>
    <div>
      <p class="verification-card__status">Tienda verificada RedAuto</p>
      <p class="verification-card__date">Verificada desde ${store?.verification?.since || '—'}</p>
    </div>
  </div>
  <p class="detail-block__text seller-note">${icon('info', { size: 14 })} La verificación de comercios en este MVP es un dato de demostración. Está pensada para conectarse a un flujo real de KYC/validación de RIF y referencias comerciales.</p>
  `;
}

function bindTabEvents(contentEl, tab, user, dashboard, refresh) {
  if (tab === 'inventario') {
    contentEl.querySelector('#btn-add-product')?.addEventListener('click', () => openProductForm({ user, refresh }));
    contentEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = dashboard.products.find((p) => p.id === btn.dataset.edit);
        openProductForm({ user, refresh, product });
      });
    });
  }
}

function openProductForm({ user, refresh, product }) {
  const isEdit = !!product;
  openModal({
    title: isEdit ? 'Editar producto' : 'Agregar producto',
    bodyHtml: `
      <form id="product-form" class="stacked-form">
        <label class="field">
          <span class="field__label">Nombre del producto</span>
          <input type="text" name="name" required value="${escapeHtml(product?.name || '')}" />
        </label>
        <div class="filters-form__row filters-form__row--2">
          <label class="field">
            <span class="field__label">Categoría</span>
            <select name="categoryId">
              ${categories.map((c) => `<option value="${c.id}" ${product?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field__label">Tipo</span>
            <select name="type">
              <option value="alternativo" ${product?.type === 'alternativo' ? 'selected' : ''}>Alternativo</option>
              <option value="original" ${product?.type === 'original' ? 'selected' : ''}>Original</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span class="field__label">Marca del repuesto</span>
          <input type="text" name="partBrand" value="${escapeHtml(product?.partBrand || '')}" />
        </label>
        <div class="filters-form__row filters-form__row--2">
          <label class="field">
            <span class="field__label">Precio (USD)</span>
            <input type="number" name="price" min="0" step="0.01" required value="${product?.price ?? ''}" />
          </label>
          <label class="field">
            <span class="field__label">Existencias</span>
            <input type="number" name="stock" min="0" step="1" value="${product?.stock ?? 0}" />
          </label>
        </div>
        <label class="field">
          <span class="field__label">Disponibilidad</span>
          <select name="availability">
            <option value="en_stock" ${product?.availability === 'en_stock' ? 'selected' : ''}>En stock</option>
            <option value="bajo_pedido" ${product?.availability === 'bajo_pedido' ? 'selected' : ''}>Bajo pedido</option>
            <option value="agotado" ${product?.availability === 'agotado' ? 'selected' : ''}>Agotado</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Descripción</span>
          <textarea name="description" rows="3">${escapeHtml(product?.description || '')}</textarea>
        </label>
        <button type="submit" class="btn btn--primary btn--block">${isEdit ? 'Guardar cambios' : 'Agregar producto'}</button>
      </form>
    `,
    onMount: (body) => {
      body.querySelector('#product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        const payload = {
          name: data.get('name'),
          categoryId: data.get('categoryId'),
          type: data.get('type'),
          partBrand: data.get('partBrand'),
          price: Number(data.get('price')),
          stock: Number(data.get('stock')),
          availability: data.get('availability'),
          description: data.get('description'),
          sku: product?.sku || `LOC-${Date.now().toString().slice(-6)}`,
          compatibility: product?.compatibility || [{ brand: 'Universal', model: 'Todas', yearFrom: 2000, yearTo: 2026 }],
        };
        const submitBtn = body.querySelector('#product-form button[type="submit"]');
        submitBtn.disabled = true;
        try {
          if (isEdit) {
            await sellerService.updateProduct(product.id, payload);
          } else {
            await sellerService.addProduct(user.storeId, payload);
          }
          closeModal();
          showToast(isEdit ? 'Producto actualizado' : 'Producto agregado', 'success');
          refresh();
        } catch (err) {
          submitBtn.disabled = false;
          showToast(err?.message || 'No se pudo guardar el producto.', 'error');
        }
      });
    },
  });
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/perfil');
  });
}

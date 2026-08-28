import { icon } from '../ui/icons.js';
import {
  backHeaderHtml, escapeHtml, formatPrice, availabilityBadge, typeBadge, emptyState, ratingInline,
} from '../ui/components.js';
import { authService } from '../services/authService.js';
import { sellerService } from '../services/sellerService.js';
import { categories } from '../data/categories.js';
import { venezuelaStates } from '../data/venezuelaStates.js';
import { navigate } from '../nav.js';
import { openModal, closeModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { openImportModal } from '../ui/productImport.js';

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
  <div class="filters-form__row filters-form__row--2">
    <button type="button" class="btn btn--primary btn--block" id="btn-add-product">${icon('plusCircle', { size: 17 })} Agregar producto</button>
    <button type="button" class="btn btn--outline btn--block" id="btn-import-excel">${icon('package', { size: 17 })} Importar por Excel</button>
  </div>
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

const VERIFICATION_COPY = {
  verificada: { icon: 'shieldCheck', title: 'Tienda verificada RedAuto', note: 'Tu tienda y tus productos ya son visibles para compradores.' },
  pendiente: { icon: 'clock', title: 'Pendiente de verificación', note: 'Un administrador de RedAuto está revisando tu tienda. Mientras tanto puedes cargar todo tu inventario — apenas se apruebe, se vuelve visible para compradores automáticamente.' },
  rechazada: { icon: 'info', title: 'Solicitud rechazada', note: 'Tu tienda no fue aprobada. Escríbenos para entender por qué y volver a intentarlo.' },
};

function renderVerificacion({ store }) {
  const status = store?.verification?.status || 'pendiente';
  const copy = VERIFICATION_COPY[status] || VERIFICATION_COPY.pendiente;
  return `
  <div class="verification-card">
    <div class="verification-card__icon">${icon(copy.icon, { size: 26 })}</div>
    <div>
      <p class="verification-card__status">${escapeHtml(copy.title)}</p>
      <p class="verification-card__date">${status === 'verificada' ? `Verificada desde ${new Date(store?.verification?.since).toLocaleDateString('es-VE')}` : 'Registrada el ' + new Date(store?.verification?.since).toLocaleDateString('es-VE')}</p>
    </div>
  </div>
  <p class="detail-block__text seller-note">${icon('info', { size: 14 })} ${escapeHtml(copy.note)}</p>
  <section class="detail-block">
    <h2 class="detail-block__title">Información de la empresa</h2>
    <div class="store-info-strip"><span>RIF</span><span>${escapeHtml(store?.rif || '—')}</span></div>
    <div class="store-info-strip"><span>Responsable</span><span>${escapeHtml(store?.responsibleName || '—')}</span></div>
    <div class="store-info-strip"><span>Dirección</span><span>${escapeHtml(store?.address || '—')}</span></div>
    <div class="store-info-strip"><span>Ciudad / Estado</span><span>${escapeHtml(store?.city || '—')} / ${escapeHtml(store?.state || '—')}</span></div>
    <div class="store-info-strip"><span>WhatsApp</span><span>${escapeHtml(store?.whatsapp || '—')}</span></div>
    <button type="button" class="btn btn--outline btn--block" id="btn-edit-store">${icon('edit', { size: 16 })} Editar información de mi tienda</button>
  </section>
  `;
}

function bindTabEvents(contentEl, tab, user, dashboard, refresh) {
  if (tab === 'inventario') {
    contentEl.querySelector('#btn-add-product')?.addEventListener('click', () => openProductForm({ user, refresh }));
    contentEl.querySelector('#btn-import-excel')?.addEventListener('click', () => openImportModal({ refresh }));
    contentEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = dashboard.products.find((p) => p.id === btn.dataset.edit);
        openProductForm({ user, refresh, product });
      });
    });
  }
  if (tab === 'verificacion') {
    contentEl.querySelector('#btn-edit-store')?.addEventListener('click', () => openStoreEditForm({ store: dashboard.store, refresh }));
  }
}

function openStoreEditForm({ store, refresh }) {
  openModal({
    title: 'Editar información de mi tienda',
    bodyHtml: `
      <form id="store-form" class="stacked-form">
        <label class="field">
          <span class="field__label">Nombre de la tienda</span>
          <input type="text" name="name" required value="${escapeHtml(store?.name || '')}" />
        </label>
        <label class="field">
          <span class="field__label">RIF</span>
          <input type="text" name="rif" value="${escapeHtml(store?.rif || '')}" />
        </label>
        <label class="field">
          <span class="field__label">Nombre del responsable</span>
          <input type="text" name="responsibleName" value="${escapeHtml(store?.responsibleName || '')}" />
        </label>
        <label class="field">
          <span class="field__label">WhatsApp</span>
          <input type="tel" name="whatsapp" value="${escapeHtml(store?.whatsapp || '')}" />
        </label>
        <label class="field">
          <span class="field__label">Teléfono</span>
          <input type="tel" name="phone" value="${escapeHtml(store?.phone || '')}" />
        </label>
        <label class="field">
          <span class="field__label">Dirección</span>
          <input type="text" name="address" value="${escapeHtml(store?.address || '')}" />
        </label>
        <div class="filters-form__row filters-form__row--2">
          <label class="field">
            <span class="field__label">Ciudad</span>
            <input type="text" name="city" value="${escapeHtml(store?.city || '')}" />
          </label>
          <label class="field">
            <span class="field__label">Estado</span>
            <select name="state">
              <option value="">Selecciona estado</option>
              ${venezuelaStates.map((s) => `<option value="${escapeHtml(s)}" ${store?.state === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="field">
          <span class="field__label">Sobre la tienda</span>
          <textarea name="about" rows="3">${escapeHtml(store?.about || '')}</textarea>
        </label>
        <label class="field">
          <span class="field__label">Categorías que vende</span>
          <div class="filters-form__pills" id="store-category-pills">
            ${categories.map((c) => `<button type="button" class="pill ${store?.categories?.includes(c.id) ? 'is-selected' : ''}" data-category-id="${c.id}">${escapeHtml(c.name)}</button>`).join('')}
          </div>
        </label>
        <button type="submit" class="btn btn--primary btn--block">Guardar cambios</button>
      </form>
    `,
    onMount: (body) => {
      const selectedIds = new Set(store?.categories || []);
      body.querySelector('#store-category-pills')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-category-id]');
        if (!btn) return;
        const id = btn.dataset.categoryId;
        if (selectedIds.has(id)) { selectedIds.delete(id); btn.classList.remove('is-selected'); }
        else { selectedIds.add(id); btn.classList.add('is-selected'); }
      });
      body.querySelector('#store-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        const submitBtn = body.querySelector('#store-form button[type="submit"]');
        submitBtn.disabled = true;
        try {
          await sellerService.updateStore({
            name: data.get('name'),
            rif: data.get('rif'),
            responsibleName: data.get('responsibleName'),
            whatsapp: data.get('whatsapp'),
            phone: data.get('phone'),
            address: data.get('address'),
            city: data.get('city'),
            state: data.get('state'),
            about: data.get('about'),
            categoryIds: [...selectedIds],
          });
          closeModal();
          showToast('Información de la tienda actualizada', 'success');
          refresh();
        } catch (err) {
          submitBtn.disabled = false;
          showToast(err?.message || 'No se pudo guardar la información.', 'error');
        }
      });
    },
  });
}

let compatRowSeq = 0;
function compatRowHtml(c = {}) {
  const rowId = `compat-${++compatRowSeq}`;
  return `
  <div class="compat-row" data-row-id="${rowId}">
    <div class="compat-row__fields">
      <label class="field">
        <span class="field__label">Marca del vehículo</span>
        <input type="text" name="compatBrand" required value="${escapeHtml(c.brand || '')}" placeholder="Toyota" />
      </label>
      <label class="field">
        <span class="field__label">Modelo</span>
        <input type="text" name="compatModel" required value="${escapeHtml(c.model || '')}" placeholder="Corolla" />
      </label>
      <label class="field">
        <span class="field__label">Año desde</span>
        <input type="number" name="compatYearFrom" value="${c.yearFrom ?? ''}" placeholder="2009" />
      </label>
      <label class="field">
        <span class="field__label">Año hasta</span>
        <input type="number" name="compatYearTo" value="${c.yearTo ?? ''}" placeholder="2013" />
      </label>
      <label class="field">
        <span class="field__label">Motor (opcional)</span>
        <input type="text" name="compatEngine" value="${escapeHtml(c.engine || '')}" placeholder="1.8L" />
      </label>
      <label class="field">
        <span class="field__label">Versión/trim (opcional)</span>
        <input type="text" name="compatTrim" value="${escapeHtml(c.trim || '')}" placeholder="LE" />
      </label>
    </div>
    <button type="button" class="icon-btn" data-remove-compat aria-label="Quitar este vehículo">${icon('trash', { size: 16 })}</button>
  </div>`;
}

function bindCompatRows(body) {
  const container = body.querySelector('#compat-rows');
  const addRow = (c) => container.insertAdjacentHTML('beforeend', compatRowHtml(c));
  body.querySelector('#btn-add-compat')?.addEventListener('click', () => addRow());
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-compat]');
    if (!btn) return;
    // Siempre queda al menos una fila — la compatibilidad es obligatoria.
    if (container.querySelectorAll('.compat-row').length <= 1) {
      showToast('Debe quedar al menos un vehículo compatible.', 'info');
      return;
    }
    btn.closest('.compat-row').remove();
  });
  return addRow;
}

function collectCompatibility(body) {
  return [...body.querySelectorAll('.compat-row')].map((row) => ({
    brand: row.querySelector('[name="compatBrand"]').value.trim(),
    model: row.querySelector('[name="compatModel"]').value.trim(),
    yearFrom: row.querySelector('[name="compatYearFrom"]').value || undefined,
    yearTo: row.querySelector('[name="compatYearTo"]').value || undefined,
    engine: row.querySelector('[name="compatEngine"]').value.trim() || undefined,
    trim: row.querySelector('[name="compatTrim"]').value.trim() || undefined,
  })).filter((c) => c.brand && c.model);
}

function openProductForm({ user, refresh, product }) {
  const isEdit = !!product;
  const initialCompat = (isEdit && product.compatibility?.length && product.compatibility[0].brand !== 'Universal')
    ? product.compatibility
    : [{}];
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
        <div class="filters-form__row filters-form__row--2">
          <label class="field">
            <span class="field__label">Marca del repuesto</span>
            <input type="text" name="partBrand" value="${escapeHtml(product?.partBrand || '')}" />
          </label>
          <label class="field">
            <span class="field__label">Código / SKU</span>
            <input type="text" name="sku" value="${escapeHtml(product?.sku || '')}" placeholder="Se genera solo si lo dejas vacío" />
          </label>
        </div>
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
        <div class="filters-form__row filters-form__row--2">
          <label class="field">
            <span class="field__label">Disponibilidad</span>
            <select name="availability">
              <option value="en_stock" ${product?.availability === 'en_stock' ? 'selected' : ''}>En stock</option>
              <option value="bajo_pedido" ${product?.availability === 'bajo_pedido' ? 'selected' : ''}>Bajo pedido</option>
              <option value="agotado" ${product?.availability === 'agotado' ? 'selected' : ''}>Agotado</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">Ubicación interna (opcional)</span>
            <input type="text" name="internalLocation" value="${escapeHtml(product?.internalLocation || '')}" placeholder="Pasillo 3, estante B" />
          </label>
        </div>
        <label class="field">
          <span class="field__label">Descripción</span>
          <textarea name="description" rows="3">${escapeHtml(product?.description || '')}</textarea>
        </label>

        <div class="field">
          <span class="field__label">Compatibilidad de vehículos (obligatorio)</span>
          <div class="compat-rows" id="compat-rows">
            ${initialCompat.map(compatRowHtml).join('')}
          </div>
          <button type="button" class="text-btn" id="btn-add-compat">${icon('plusCircle', { size: 14 })} Agregar otro vehículo</button>
        </div>

        <button type="submit" class="btn btn--primary btn--block">${isEdit ? 'Guardar cambios' : 'Agregar producto'}</button>
      </form>
    `,
    onMount: (body) => {
      bindCompatRows(body);
      body.querySelector('#product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        const compatibility = collectCompatibility(body);
        if (!compatibility.length) {
          showToast('Agrega al menos un vehículo compatible (marca y modelo).', 'error');
          return;
        }
        const payload = {
          name: data.get('name'),
          categoryId: data.get('categoryId'),
          type: data.get('type'),
          partBrand: data.get('partBrand'),
          sku: data.get('sku') || product?.sku || `LOC-${Date.now().toString().slice(-6)}`,
          price: Number(data.get('price')),
          stock: Number(data.get('stock')),
          availability: data.get('availability'),
          internalLocation: data.get('internalLocation'),
          description: data.get('description'),
          compatibility,
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

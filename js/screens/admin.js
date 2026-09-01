import { icon } from '../ui/icons.js';
import { backHeaderHtml, escapeHtml, emptyState } from '../ui/components.js';
import { authService } from '../services/authService.js';
import { adminService } from '../services/adminService.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';

const TABS = [
  { status: 'pendiente', label: 'Pendientes' },
  { status: 'verificada', label: 'Verificadas' },
  { status: 'rechazada', label: 'Rechazadas' },
  { status: '', label: 'Todas' },
];

const STATUS_BADGE = {
  pendiente: { modifier: 'wait', label: 'Pendiente' },
  verificada: { modifier: 'ok', label: 'Verificada' },
  rechazada: { modifier: 'off', label: 'Rechazada' },
};

export async function render(container) {
  const user = authService.getCurrentUser();

  if (!user || user.role !== 'admin') {
    container.innerHTML = `
      ${backHeaderHtml('Panel de administración')}
      <div class="screen-pad">
        ${emptyState({
          iconName: 'shieldCheck',
          title: 'Esta sección es solo para administradores',
          message: 'Tu cuenta no tiene permisos de administrador en RedAuto.',
          actionLabel: 'Volver a mi perfil',
          actionHref: '#/perfil',
        })}
      </div>
    `;
    bindBack(container);
    return;
  }

  let activeStatus = 'pendiente';

  container.innerHTML = `
    ${backHeaderHtml('Panel de administración')}
    <div class="screen-pad admin-panel">
      <p class="detail-block__text seller-note">${icon('info', { size: 14 })} Aprobar o rechazar una tienda la hace visible (o no) para compradores de inmediato — no hace falta ningún paso extra.</p>
      <div class="tab-bar" id="admin-tabs" role="tablist">
        ${TABS.map((t) => `
          <button type="button" class="tab-bar__item ${t.status === activeStatus ? 'is-active' : ''}" data-status="${t.status}" role="tab" aria-selected="${t.status === activeStatus}">
            ${escapeHtml(t.label)}
          </button>`).join('')}
      </div>
      <div id="admin-store-list"><div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div></div>
    </div>
  `;
  bindBack(container);

  const tabsEl = container.querySelector('#admin-tabs');
  const listEl = container.querySelector('#admin-store-list');

  async function paintList() {
    listEl.innerHTML = '<div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div>';
    let stores;
    try {
      stores = await adminService.listStores(activeStatus);
    } catch (err) {
      listEl.innerHTML = emptyState({
        iconName: 'info',
        title: 'No se pudo cargar la lista',
        message: err?.message || 'Intenta de nuevo en unos segundos.',
      });
      return;
    }
    if (!stores.length) {
      listEl.innerHTML = emptyState({ iconName: 'store', title: 'No hay tiendas en este filtro' });
      return;
    }
    listEl.innerHTML = stores.map(storeCardHtml).join('');
    bindCardEvents();
  }

  function bindCardEvents() {
    listEl.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => handleVerificationChange(btn, 'verificada'));
    });
    listEl.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => handleVerificationChange(btn, 'rechazada'));
    });
  }

  async function handleVerificationChange(btn, status) {
    const card = btn.closest('[data-store-id]');
    const storeId = card.dataset.storeId;
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await adminService.setStoreVerification(storeId, status);
      showToast(status === 'verificada' ? 'Tienda aprobada' : 'Tienda rechazada', 'success');
      paintList();
    } catch (err) {
      showToast(err?.message || 'No se pudo actualizar la tienda.', 'error');
      card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    activeStatus = btn.dataset.status;
    tabsEl.querySelectorAll('[data-status]').forEach((b) => {
      const isActive = b.dataset.status === activeStatus;
      b.classList.toggle('is-active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    });
    paintList();
  });

  paintList();
}

function storeCardHtml(store) {
  const status = store.verification?.status || 'pendiente';
  const badge = STATUS_BADGE[status] || STATUS_BADGE.pendiente;
  const since = store.verification?.since ? new Date(store.verification.since).toLocaleDateString('es-VE') : '—';
  return `
  <article class="admin-store-card" data-store-id="${store.id}">
    <div class="admin-store-card__head">
      <p class="admin-store-card__name">${escapeHtml(store.name)}</p>
      <span class="badge badge--${badge.modifier}">${badge.label}</span>
    </div>
    <div class="store-info-strip"><span>RIF</span><span>${escapeHtml(store.rif || '—')}</span></div>
    <div class="store-info-strip"><span>Responsable</span><span>${escapeHtml(store.responsibleName || '—')}</span></div>
    <div class="store-info-strip"><span>Ciudad / Estado</span><span>${escapeHtml(store.city || '—')} / ${escapeHtml(store.state || '—')}</span></div>
    <div class="store-info-strip"><span>WhatsApp</span><span>${escapeHtml(store.whatsapp || '—')}</span></div>
    <div class="store-info-strip"><span>Registrada</span><span>${escapeHtml(since)}</span></div>
    <div class="store-info-strip"><span>Productos cargados</span><span>${store.productCount ?? 0}</span></div>
    <div class="admin-store-card__actions">
      <a href="#/tienda/${store.id}" class="btn btn--outline btn--block">${icon('eye', { size: 15 })} Ver tienda</a>
      ${status !== 'verificada' ? `<button type="button" data-approve class="btn btn--primary btn--block">${icon('check', { size: 15 })} Aprobar</button>` : ''}
      ${status !== 'rechazada' ? `<button type="button" data-reject class="btn btn--ghost btn--block">${icon('x', { size: 15 })} Rechazar</button>` : ''}
    </div>
  </article>`;
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/perfil');
  });
}

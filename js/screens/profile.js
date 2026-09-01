import { icon } from '../ui/icons.js';
import { escapeHtml, emptyState } from '../ui/components.js';
import { authService } from '../services/authService.js';
import { orderService } from '../services/orderService.js';
import { vehicleService } from '../services/vehicleService.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';

const STATUS_MODIFIER = {
  Entregado: 'ok',
  'En camino': 'wait',
  Procesando: 'wait',
  'Pendiente de pago': 'off',
  'Pendiente de pago (MVP)': 'off',
  Cancelado: 'off',
};

export async function render(container) {
  const user = authService.getCurrentUser();

  if (!user) {
    container.innerHTML = `
      <header class="top-header"><h1 class="top-header__title">Mi cuenta</h1></header>
      <div class="screen-pad">
        ${emptyState({
          iconName: 'user',
          title: 'Inicia sesión para ver tu perfil',
          message: 'Guarda tu vehículo, revisa tus pedidos y compra más rápido.',
        })}
        <div class="auth-prompt-actions">
          <a href="#/login" class="btn btn--primary btn--block">Iniciar sesión</a>
          <a href="#/registro" class="btn btn--ghost btn--block">Crear cuenta</a>
        </div>
      </div>
    `;
    return;
  }

  const garage = vehicleService.getGarage();
  const active = vehicleService.getActive();
  const garageMeta = garage.length
    ? `${garage.length} guardado${garage.length === 1 ? '' : 's'}${active ? ` · Activo: ${active.brand} ${active.model}` : ''}`
    : 'Agrega tu primer vehículo';

  container.innerHTML = `
    <header class="top-header"><h1 class="top-header__title">Mi cuenta</h1></header>
    <div class="screen-pad">
      <section class="profile-card">
        <div class="profile-card__avatar">${escapeHtml(initials(user.name))}</div>
        <div>
          <p class="profile-card__name">${escapeHtml(user.name)}</p>
          <p class="profile-card__email">${escapeHtml(user.email)}</p>
        </div>
      </section>

      ${user.role === 'vendedor' ? `
      <a href="#/vendedor" class="seller-cta">
        <span>${icon('store', { size: 18 })} Ir al panel de vendedor</span>
        ${icon('chevronRight', { size: 18 })}
      </a>` : ''}
      ${user.role === 'admin' ? `
      <a href="#/admin" class="seller-cta">
        <span>${icon('shieldCheck', { size: 18 })} Panel de administración</span>
        ${icon('chevronRight', { size: 18 })}
      </a>` : ''}

      <div class="menu-list">
        <a href="#/mis-vehiculos" class="menu-row">
          <span class="menu-row__icon">${icon('car', { size: 18 })}</span>
          <span class="menu-row__body">
            <span class="menu-row__label">Mis vehículos</span>
            <span class="menu-row__meta">${escapeHtml(garageMeta)}</span>
          </span>
          ${icon('chevronRight', { size: 16 })}
        </a>
        <a href="#/favoritos" class="menu-row">
          <span class="menu-row__icon">${icon('heart', { size: 18 })}</span>
          <span class="menu-row__body">
            <span class="menu-row__label">Favoritos</span>
            <span class="menu-row__meta">Productos y tiendas guardadas</span>
          </span>
          ${icon('chevronRight', { size: 16 })}
        </a>
        <a href="#/notificaciones" class="menu-row">
          <span class="menu-row__icon">${icon('bell', { size: 18 })}</span>
          <span class="menu-row__body">
            <span class="menu-row__label">Notificaciones</span>
            <span class="menu-row__meta">Pedidos, ofertas y novedades</span>
          </span>
          ${icon('chevronRight', { size: 16 })}
        </a>
      </div>

      <section class="detail-block">
        <h2 class="detail-block__title">Mis pedidos</h2>
        <div id="orders-list">${Array.from({ length: 2 }, () => '<div class="skeleton skeleton--row"></div>').join('')}</div>
      </section>

      <button type="button" class="btn btn--ghost btn--block" id="btn-logout">${icon('logOut', { size: 16 })} Cerrar sesión</button>
    </div>
  `;

  container.querySelector('#btn-logout')?.addEventListener('click', () => {
    authService.logout();
    showToast('Sesión cerrada', 'info');
    navigate('/');
  });

  const orders = await orderService.getOrdersForUser(user.id);
  const listEl = container.querySelector('#orders-list');
  if (!listEl) return;
  if (!orders.length) {
    listEl.innerHTML = emptyState({ iconName: 'package', title: 'Todavía no tienes pedidos', actionLabel: 'Explorar productos', actionHref: '#/buscar' });
    return;
  }
  listEl.innerHTML = orders
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((o) => orderRow(o))
    .join('');
}

function orderRow(order) {
  const modifier = STATUS_MODIFIER[order.status] || 'wait';
  return `
  <article class="order-row">
    <div>
      <p class="order-row__id">#${order.id}</p>
      <p class="order-row__date">${order.date} · ${order.items.length} producto${order.items.length === 1 ? '' : 's'}</p>
    </div>
    <div class="order-row__side">
      <span class="badge badge--${modifier}">${order.status}</span>
      <span class="order-row__total">$${order.total.toFixed(2)}</span>
    </div>
  </article>`;
}

function initials(name) {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

import { icon } from '../ui/icons.js';
import { escapeHtml, emptyState } from '../ui/components.js';
import { notificationService } from '../services/notificationService.js';

const TYPE_ICON = {
  order: 'package',
  offer: 'trendUp',
  product: 'plusCircle',
  promo: 'star',
  system: 'shieldCheck',
};

export async function render(container) {
  paint(container);
}

function paint(container) {
  const items = notificationService.getAll();

  container.innerHTML = `
    <header class="top-header">
      <h1 class="top-header__title">Notificaciones</h1>
      <button type="button" class="text-btn" id="btn-mark-all" ${items.every((n) => n.read) ? 'hidden' : ''}>Marcar todas</button>
    </header>
    <div class="screen-pad">
      ${items.length ? `<div class="notif-feed">${items.map(notifRow).join('')}</div>` : emptyState({
        iconName: 'bell', title: 'No tienes notificaciones', message: 'Aquí verás tus pedidos, ofertas y novedades de tiendas verificadas.',
      })}
    </div>
  `;

  container.querySelector('#btn-mark-all')?.addEventListener('click', () => {
    notificationService.markAllRead();
    paint(container);
  });

  container.querySelectorAll('[data-notif-id]').forEach((row) => {
    row.addEventListener('click', () => {
      if (!row.classList.contains('is-unread')) return;
      notificationService.markRead(row.dataset.notifId);
      paint(container);
    });
  });
}

function notifRow(n) {
  return `
  <article class="notif-feed__item ${n.read ? '' : 'is-unread'}" data-notif-id="${n.id}">
    <span class="notif-feed__icon">${icon(TYPE_ICON[n.type] || 'bell', { size: 17 })}</span>
    <div class="notif-feed__body">
      <p class="notif-feed__title">${escapeHtml(n.title)}</p>
      <p class="notif-feed__message">${escapeHtml(n.message)}</p>
      <p class="notif-feed__time">${relativeTime(n.date)}</p>
    </div>
    ${n.read ? '' : '<span class="notif-feed__dot" aria-hidden="true"></span>'}
  </article>`;
}

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return 'Hace un momento';
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

import { icon } from '../ui/icons.js';
import { backHeaderHtml, formatPrice, escapeHtml, emptyState } from '../ui/components.js';
import { cartService } from '../services/cartService.js';
import { authService } from '../services/authService.js';
import { orderService } from '../services/orderService.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';

export async function render(container) {
  const user = authService.getCurrentUser();
  if (!user) {
    navigate('/login?next=/checkout');
    return;
  }

  const items = await cartService.getItems();
  if (!items.length) {
    container.innerHTML = `
      ${backHeaderHtml('Finalizar compra')}
      <div class="screen-pad">${emptyState({ iconName: 'cart', title: 'Tu carrito está vacío', actionLabel: 'Explorar productos', actionHref: '#/buscar' })}</div>
    `;
    bindBack(container);
    return;
  }

  const { subtotal } = await cartService.totals();
  container.classList.add('screen-content--with-sticky-actions');

  container.innerHTML = `
    ${backHeaderHtml('Finalizar compra')}
    <div class="screen-pad">
      <section class="detail-block">
        <h2 class="detail-block__title">Resumen (${items.length} producto${items.length === 1 ? '' : 's'})</h2>
        <div class="checkout-summary-list">
          ${items.map((i) => `
            <div class="checkout-summary-row">
              <span>${i.qty}× ${escapeHtml(i.product.name)}</span>
              <span>${formatPrice(i.product.price * i.qty)}</span>
            </div>`).join('')}
        </div>
        <div class="summary-card">
          <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
          <div class="summary-row summary-row--muted"><span>Envío</span><span>A calcular con la tienda</span></div>
          <div class="summary-row summary-row--total"><span>Total estimado</span><span>${formatPrice(subtotal)}</span></div>
        </div>
      </section>

      <section class="detail-block">
        <h2 class="detail-block__title">Datos de entrega</h2>
        <form id="checkout-form" class="stacked-form" novalidate>
          <label class="field">
            <span class="field__label">Nombre completo</span>
            <input type="text" name="name" required value="${escapeHtml(user.name)}" />
          </label>
          <label class="field">
            <span class="field__label">Teléfono</span>
            <input type="tel" name="phone" required value="${escapeHtml(user.phone || '')}" placeholder="+58 412-0000000" />
          </label>
          <label class="field">
            <span class="field__label">Ciudad</span>
            <input type="text" name="city" required value="${escapeHtml(user.city || '')}" />
          </label>
          <label class="field">
            <span class="field__label">Dirección</span>
            <textarea name="address" required rows="2" placeholder="Av., calle, referencia…"></textarea>
          </label>
          <p class="field-error" id="checkout-error" hidden></p>
        </form>
      </section>

      <section class="detail-block payment-mvp">
        <h2 class="detail-block__title">${icon('info', { size: 16 })} Pago — próximamente</h2>
        <p class="detail-block__text">RedAuto todavía no procesa pagos en línea. Al confirmar, tu pedido queda registrado como <strong>pendiente de pago</strong> y la tienda se pondrá en contacto para coordinar el cobro y la entrega.</p>
      </section>
    </div>

    <div class="sticky-actions sticky-actions--single">
      <button type="button" class="btn btn--primary btn--block" id="btn-confirm-order">Confirmar pedido (modo demo)</button>
    </div>
  `;

  bindBack(container);

  container.querySelector('#btn-confirm-order')?.addEventListener('click', async () => {
    const form = container.querySelector('#checkout-form');
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const shippingInfo = {
      name: data.get('name'),
      phone: data.get('phone'),
      city: data.get('city'),
      address: data.get('address'),
    };
    const btn = container.querySelector('#btn-confirm-order');
    btn.disabled = true;
    btn.textContent = 'Confirmando…';
    const result = await orderService.checkout(user.id, shippingInfo);
    if (!result.ok) {
      showToast(result.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Confirmar pedido (modo demo)';
      return;
    }
    renderConfirmation(container, result.order);
  });
}

function renderConfirmation(container, order) {
  container.classList.remove('screen-content--with-sticky-actions');
  container.innerHTML = `
    ${backHeaderHtml('Pedido registrado')}
    <div class="screen-pad">
      <div class="confirmation-card">
        <div class="confirmation-card__icon">${icon('check', { size: 30 })}</div>
        <h1 class="confirmation-card__title">¡Pedido registrado!</h1>
        <p class="confirmation-card__text">Tu pedido <strong>#${order.id}</strong> quedó en estado <strong>${order.status}</strong>. Esto es un MVP sin pasarela de pago: la tienda te contactará para coordinar el cobro y el envío.</p>
        <div class="confirmation-card__actions">
          <a href="#/perfil" class="btn btn--primary">Ver mis pedidos</a>
          <a href="#/" class="btn btn--ghost">Volver al inicio</a>
        </div>
      </div>
    </div>
  `;
  bindBack(container);
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : navigate('/carrito');
  });
}

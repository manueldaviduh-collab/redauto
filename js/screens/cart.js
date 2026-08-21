import { icon } from '../ui/icons.js';
import { productTile, formatPrice, escapeHtml, emptyState } from '../ui/components.js';
import { cartService, CART_CHANGED_EVENT } from '../services/cartService.js';
import { authService } from '../services/authService.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';

export async function render(container) {
  container.innerHTML = `
    <header class="top-header">
      <h1 class="top-header__title">Carrito</h1>
      <button type="button" class="text-btn" id="btn-clear-cart" hidden>Vaciar</button>
    </header>
    <div class="screen-pad" id="cart-body">
      <div class="skeleton skeleton--hero"></div>
    </div>
  `;

  await load(container);
  window.addEventListener(CART_CHANGED_EVENT, () => load(container));
}

async function load(container) {
  const body = container.querySelector('#cart-body');
  const clearBtn = container.querySelector('#btn-clear-cart');
  if (!body) return;

  const items = await cartService.getItems();

  if (!items.length) {
    clearBtn.hidden = true;
    body.innerHTML = emptyState({
      iconName: 'cart',
      title: 'Tu carrito está vacío',
      message: 'Explora el catálogo y agrega los repuestos que necesitas.',
      actionLabel: 'Explorar productos',
      actionHref: '#/buscar',
    });
    return;
  }

  clearBtn.hidden = false;
  clearBtn.onclick = () => {
    cartService.clear();
    showToast('Carrito vaciado', 'info');
  };

  const { subtotal } = await cartService.totals();

  body.innerHTML = `
    <div class="cart-list">
      ${items.map((i) => cartRow(i)).join('')}
    </div>
    <div class="summary-card">
      <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
      <div class="summary-row summary-row--muted"><span>Envío</span><span>Se calcula al finalizar</span></div>
      <div class="summary-row summary-row--total"><span>Total estimado</span><span>${formatPrice(subtotal)}</span></div>
    </div>
    <button type="button" class="btn btn--primary btn--block" id="btn-checkout">Continuar al pago</button>
  `;

  body.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('[data-product-id]').dataset.productId;
      const current = Number(btn.closest('.cart-row').querySelector('.qty-stepper__value').textContent);
      cartService.updateQty(id, current + Number(btn.dataset.step));
    });
  });
  body.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cartService.removeItem(btn.dataset.remove);
      showToast('Producto eliminado del carrito', 'info');
    });
  });
  body.querySelector('#btn-checkout')?.addEventListener('click', () => {
    if (!authService.isAuthenticated()) {
      showToast('Inicia sesión para finalizar tu compra', 'info');
      navigate('/login?next=/checkout');
      return;
    }
    navigate('/checkout');
  });
}

function cartRow({ product, qty }) {
  return `
  <article class="cart-row" data-product-id="${product.id}">
    <div class="cart-row__media">${productTile(product)}</div>
    <div class="cart-row__body">
      <p class="cart-row__name">${escapeHtml(product.name)}</p>
      <p class="cart-row__price">${formatPrice(product.price)} c/u</p>
      <div class="qty-stepper qty-stepper--sm">
        <button type="button" class="qty-stepper__btn" data-step="-1" aria-label="Disminuir cantidad">${icon('minus', { size: 14 })}</button>
        <span class="qty-stepper__value">${qty}</span>
        <button type="button" class="qty-stepper__btn" data-step="1" aria-label="Aumentar cantidad">${icon('plus', { size: 14 })}</button>
      </div>
    </div>
    <div class="cart-row__side">
      <span class="cart-row__line-total">${formatPrice(product.price * qty)}</span>
      <button type="button" class="icon-btn" data-remove="${product.id}" aria-label="Eliminar del carrito">${icon('trash', { size: 17 })}</button>
    </div>
  </article>`;
}

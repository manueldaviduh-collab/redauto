// Chat de preguntas a la tienda. No hay mensajería real con backend: las
// respuestas se generan a partir de los datos reales del producto/tienda
// (compatibilidad, stock, tipo, entrega) para que resolver la duda sea
// genuinamente útil — y el punto central del principio de conversión de
// RedAuto: la duda se resuelve AQUÍ, y el siguiente paso natural es comprar
// sin salir de la plataforma, con WhatsApp/llamada como opción secundaria.
import { icon, whatsappGlyph } from './icons.js';
import { openModal, closeModal } from './modal.js';
import { escapeHtml, whatsappLink } from './components.js';
import { productService } from '../services/productService.js';
import { vehicleService } from '../services/vehicleService.js';
import { cartService } from '../services/cartService.js';
import { showToast } from './toast.js';
import { navigate } from '../nav.js';

function productQuestions(product, store) {
  const activeVehicle = vehicleService.getActive();
  const vehicleLabel = activeVehicle ? `${activeVehicle.brand} ${activeVehicle.model} ${activeVehicle.year}` : null;
  return [
    {
      q: vehicleLabel ? `¿Le sirve a mi ${vehicleLabel}?` : '¿Es compatible con mi vehículo?',
      a: () => {
        const compatList = product.compatibility
          .map((c) => (c.brand === 'Universal' ? c.model : `${c.brand} ${c.model} (${c.yearFrom}-${c.yearTo})`))
          .join(', ');
        if (!activeVehicle) {
          return `Este producto está registrado como compatible con: ${compatList}. Agrega tu vehículo en "Mis Vehículos" y te lo confirmamos al instante la próxima vez. ✅`;
        }
        return productService.matchesVehicle(product, activeVehicle)
          ? `Sí, es compatible con tu ${vehicleLabel}. ✅`
          : `Con los datos que tenemos, no está confirmado para tu ${vehicleLabel}. Compatibilidad registrada: ${compatList}.`;
      },
    },
    {
      q: '¿Tienen disponible?',
      a: () => {
        const tier = productService.stockTier(product);
        if (tier === 'disponible') return `Sí, tenemos ${product.stock} unidades disponibles ahorita mismo.`;
        if (tier === 'bajas') return `Nos quedan solo ${product.stock} unidades — te recomendamos asegurarlo pronto.`;
        if (tier === 'agotado') return 'Está agotado por ahora. Guárdalo en favoritos y te avisamos apenas vuelva a stock.';
        return 'No tenemos stock inmediato, pero podemos conseguirlo bajo pedido.';
      },
    },
    {
      q: '¿Es original o alternativo?',
      a: () => (product.type === 'original'
        ? `Es una pieza ORIGINAL ${escapeHtml(product.partBrand)}, con respaldo de fábrica.`
        : `Es una pieza ALTERNATIVA de ${escapeHtml(product.partBrand)}: buena calidad a un precio más accesible que la original.`),
    },
    {
      q: '¿Cuánto tarda en llegar?',
      a: () => {
        const fast = (store.deliveryOptions || []).includes('hoy')
          ? ' Para tu zona podemos tener entrega hoy mismo.'
          : (store.deliveryOptions || []).includes('manana') ? ' Podemos tener entrega mañana.' : '';
        return `${store.delivery.shipping}.${fast}`;
      },
    },
    {
      q: '¿Puedo retirarlo hoy?',
      a: () => (store.delivery.pickup
        ? `Sí, puedes retirarlo en ${escapeHtml(store.address)}. Horario: ${escapeHtml(store.hours)}.`
        : 'Por ahora esta tienda no ofrece retiro en tienda, solo envío.'),
    },
  ];
}

function storeQuestions(store) {
  return [
    { q: '¿Cuál es su horario de atención?', a: () => `Nuestro horario es: ${escapeHtml(store.hours)}.` },
    { q: '¿Hacen envíos a mi ciudad?', a: () => `${store.delivery.shipping}. Estamos en ${escapeHtml(store.city)}.` },
    { q: '¿Están verificados por RedAuto?', a: () => `Sí, somos Tienda verificada RedAuto desde ${store.verification.since}, con ${store.rating.toFixed(1)}★ y ${store.reviewsCount} reseñas.` },
    { q: '¿Puedo retirar mi pedido en tienda?', a: () => (store.delivery.pickup ? `Sí, en ${escapeHtml(store.address)}.` : 'Por ahora solo hacemos envíos.') },
  ];
}

function bubble(role, html) {
  return `<div class="chat-bubble chat-bubble--${role}">${html}</div>`;
}

export function openStoreChat({ store, product }) {
  const questions = product ? productQuestions(product, store) : storeQuestions(store);
  const subtitle = product ? escapeHtml(product.name) : `${escapeHtml(store.city)} · Tienda verificada`;

  openModal({
    title: `Pregúntale a ${escapeHtml(store.name)}`,
    ariaLabel: `Chat con ${store.name}`,
    bodyHtml: `
      <div class="chat-widget">
        <p class="chat-widget__subtitle">${subtitle}</p>
        <div class="chat-widget__messages" id="chat-messages">
          ${bubble('store', `Hola 👋 Soy el asistente de ${escapeHtml(store.name)}. Elige una pregunta o escribe la tuya.`)}
        </div>
        <div class="chat-widget__quick" id="chat-quick">
          ${questions.map((item, i) => `<button type="button" class="chat-chip" data-q="${i}">${escapeHtml(item.q)}</button>`).join('')}
        </div>
        <form class="chat-widget__composer" id="chat-composer">
          <input type="text" id="chat-input" placeholder="Escribe tu pregunta…" aria-label="Escribe tu pregunta" autocomplete="off" />
          <button type="submit" class="btn-icon-primary" aria-label="Enviar">${icon('chevronRight', { size: 18 })}</button>
        </form>
        <div class="chat-widget__cta" id="chat-cta" hidden>
          ${product ? `
            <button type="button" class="btn btn--outline" id="chat-add-cart">${icon('cart', { size: 16 })} Agregar al carrito</button>
            <button type="button" class="btn btn--primary" id="chat-buy-now">Comprar ahora</button>
          ` : `
            <button type="button" class="btn btn--primary btn--block" id="chat-view-catalog">Ver catálogo</button>
          `}
        </div>
        <div class="chat-widget__fallback">
          <span>¿Prefieres hablar directo?</span>
          <a href="${whatsappLink(store.phone, product ? `Hola ${store.name}, tengo una duda sobre "${product.name}" en RedAuto.` : `Hola ${store.name}, te escribo desde RedAuto.`)}" target="_blank" rel="noopener" class="chat-widget__fallback-link">${whatsappGlyph({ size: 14 })} WhatsApp</a>
          <a href="tel:${store.phone.replace(/\s|-/g, '')}" class="chat-widget__fallback-link">${icon('phone', { size: 13 })} Llamar</a>
        </div>
      </div>
    `,
    onMount: (body) => bindChat(body, { store, product, questions }),
  });
}

function bindChat(body, { store, product, questions }) {
  const messages = body.querySelector('#chat-messages');
  const quick = body.querySelector('#chat-quick');
  const cta = body.querySelector('#chat-cta');
  const composer = body.querySelector('#chat-composer');
  const input = body.querySelector('#chat-input');

  function scrollToEnd() {
    messages.scrollTop = messages.scrollHeight;
  }

  function reply(html) {
    const typing = document.createElement('div');
    typing.className = 'chat-bubble chat-bubble--store chat-bubble--typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(typing);
    scrollToEnd();
    setTimeout(() => {
      typing.outerHTML = bubble('store', html);
      scrollToEnd();
      cta.hidden = false;
    }, 550);
  }

  quick.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-q]');
    if (!btn) return;
    const item = questions[Number(btn.dataset.q)];
    messages.insertAdjacentHTML('beforeend', bubble('user', escapeHtml(item.q)));
    btn.disabled = true;
    scrollToEnd();
    reply(item.a());
  });

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    messages.insertAdjacentHTML('beforeend', bubble('user', escapeHtml(text)));
    input.value = '';
    scrollToEnd();
    reply(`Gracias por tu mensaje. Esta tienda suele responder en <strong>${escapeHtml(store.responseTime)}</strong>. Mientras tanto, ya tienes la disponibilidad y compatibilidad arriba 👆`);
  });

  if (product) {
    cta.querySelector('#chat-add-cart')?.addEventListener('click', () => {
      cartService.addItem(product.id, 1);
      showToast('Agregado al carrito', 'success');
      closeModal();
    });
    cta.querySelector('#chat-buy-now')?.addEventListener('click', () => {
      cartService.addItem(product.id, 1);
      closeModal();
      navigate('/checkout');
    });
  } else {
    cta.querySelector('#chat-view-catalog')?.addEventListener('click', () => {
      closeModal();
      document.getElementById('store-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

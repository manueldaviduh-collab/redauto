import { getItem, setItem } from './storage.js';
import { productService } from './productService.js';

// Carrito persistido en localStorage mientras no existe backend de
// checkout. Cada escritura dispara un CustomEvent global para que cualquier
// pantalla (badge del header, nav inferior, la propia vista de carrito)
// pueda reaccionar sin acoplarse a cómo se guarda el estado.
const CART_KEY = 'cart';
export const CART_CHANGED_EVENT = 'redauto:cart-changed';

function readRaw() {
  return getItem(CART_KEY, []); // [{ productId, qty }]
}

function writeRaw(items) {
  setItem(CART_KEY, items);
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
}

export const cartService = {
  getRawCount() {
    return readRaw().reduce((sum, i) => sum + i.qty, 0);
  },

  async getItems() {
    const raw = readRaw();
    const items = await Promise.all(
      raw.map(async (entry) => {
        const product = await productService.getById(entry.productId);
        return product ? { product, qty: entry.qty } : null;
      })
    );
    return items.filter(Boolean);
  },

  addItem(productId, qty = 1) {
    const raw = readRaw();
    const existing = raw.find((i) => i.productId === productId);
    if (existing) {
      existing.qty += qty;
    } else {
      raw.push({ productId, qty });
    }
    writeRaw(raw);
  },

  updateQty(productId, qty) {
    let raw = readRaw();
    if (qty <= 0) {
      raw = raw.filter((i) => i.productId !== productId);
    } else {
      const entry = raw.find((i) => i.productId === productId);
      if (entry) entry.qty = qty;
    }
    writeRaw(raw);
  },

  removeItem(productId) {
    writeRaw(readRaw().filter((i) => i.productId !== productId));
  },

  clear() {
    writeRaw([]);
  },

  async totals() {
    const items = await this.getItems();
    const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
    const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
    return { subtotal, itemCount };
  },
};

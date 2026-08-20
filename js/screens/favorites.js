import { icon } from '../ui/icons.js';
import {
  productListRow, storeCard, emptyState, bindProductCardEvents, bindStoreCardEvents, sectionSkeletonGrid,
} from '../ui/components.js';
import { favoritesService } from '../services/favoritesService.js';
import { productService } from '../services/productService.js';
import { storeService } from '../services/storeService.js';

const TABS = [
  { id: 'productos', label: 'Productos', icon: 'heart' },
  { id: 'tiendas', label: 'Tiendas', icon: 'store' },
];

export async function render(container) {
  let activeTab = 'productos';

  container.innerHTML = `
    <header class="top-header"><h1 class="top-header__title">Favoritos</h1></header>
    <div class="screen-pad">
      <div class="tab-bar" id="fav-tabs" role="tablist">
        ${TABS.map((t) => `
          <button type="button" class="tab-bar__item ${t.id === activeTab ? 'is-active' : ''}" data-tab="${t.id}" role="tab">
            ${icon(t.icon, { size: 16 })} ${t.label}
          </button>`).join('')}
      </div>
      <div id="fav-content">${sectionSkeletonGrid(3, 'product')}</div>
    </div>
  `;

  const tabsEl = container.querySelector('#fav-tabs');
  const contentEl = container.querySelector('#fav-content');

  async function paint() {
    tabsEl.querySelectorAll('[data-tab]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === activeTab));
    contentEl.innerHTML = sectionSkeletonGrid(3, activeTab === 'tiendas' ? 'store' : 'product');

    if (activeTab === 'productos') {
      const ids = favoritesService.getIds();
      const products = (await Promise.all(ids.map((id) => productService.getById(id)))).filter(Boolean);
      if (!products.length) {
        contentEl.innerHTML = emptyState({
          iconName: 'heart', title: 'Aún no guardas productos favoritos',
          message: 'Toca el corazón en cualquier producto para encontrarlo rápido aquí.',
          actionLabel: 'Explorar productos', actionHref: '#/buscar',
        });
        return;
      }
      const stores = await storeService.getAll();
      const storeMap = new Map(stores.map((s) => [s.id, s]));
      contentEl.innerHTML = `<div class="product-list">${products.map((p) => productListRow(p, storeMap.get(p.storeId))).join('')}</div>`;
      bindProductCardEvents(contentEl);
    } else {
      const ids = favoritesService.stores.getIds();
      const all = await storeService.getAll();
      const stores = all.filter((s) => ids.includes(s.id));
      if (!stores.length) {
        contentEl.innerHTML = emptyState({
          iconName: 'store', title: 'Aún no guardas tiendas favoritas',
          message: 'Toca la estrella en el perfil de una tienda para encontrarla rápido aquí.',
          actionLabel: 'Ver tiendas verificadas', actionHref: '#/tiendas',
        });
        return;
      }
      contentEl.innerHTML = `<div class="store-list">${stores.map((s) => storeCard(s)).join('')}</div>`;
      bindStoreCardEvents(contentEl);
    }
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    paint();
  });

  await paint();
}

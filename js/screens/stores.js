import { icon } from '../ui/icons.js';
import { storeCard, sectionSkeletonGrid, emptyState, bindStoreCardEvents } from '../ui/components.js';
import { storeService } from '../services/storeService.js';

export async function render(container, { query }) {
  container.innerHTML = `
    <header class="top-header">
      <h1 class="top-header__title">Tiendas verificadas</h1>
    </header>
    <div class="screen-pad">
      <form class="search-bar" id="store-search-form" role="search">
        <span class="search-bar__icon">${icon('search', { size: 18 })}</span>
        <input type="search" id="store-search-input" placeholder="Buscar tienda o ciudad…" value="${query.q || ''}" aria-label="Buscar tiendas" />
      </form>
      <p class="trust-line trust-line--tight">${icon('shieldCheck', { size: 15 })} Todas las tiendas de RedAuto pasan por un proceso de verificación.</p>
      <div class="store-list" id="store-list">${sectionSkeletonGrid(4, 'store')}</div>
    </div>
  `;

  container.querySelector('#store-search-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    load(container.querySelector('#store-search-input').value.trim());
  });

  await load(query.q || '');
}

async function load(query) {
  const list = document.getElementById('store-list');
  if (!list) return;
  list.innerHTML = sectionSkeletonGrid(4, 'store');
  const stores = await storeService.search(query);
  if (!stores.length) {
    list.innerHTML = emptyState({
      iconName: 'store',
      title: 'No encontramos tiendas con ese criterio',
      message: 'Prueba buscando por nombre de tienda o ciudad.',
    });
    return;
  }
  list.innerHTML = stores.map((s) => storeCard(s)).join('');
  bindStoreCardEvents(list);
}

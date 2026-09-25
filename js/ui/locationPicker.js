import { escapeHtml } from './components.js';
import { openModal, closeModal } from './modal.js';
import { storeService } from '../services/storeService.js';
import { locationService } from '../services/locationService.js';
import { navigate } from '../nav.js';

// Selector de ciudad — antes vivía sólo dentro de home.js; se extrae acá
// para que Buscar y Tiendas también puedan abrirlo (el botón "Cambiar
// ubicación" del estado vacío de zona lo necesita). Mismo modal, mismo
// estilo, mismo comportamiento de siempre — sólo cambia de archivo.
const CITIES = [
  'Caracas', 'Barcelona', 'Barinas', 'Barquisimeto', 'Cabimas', 'Ciudad Bolívar',
  'Coro', 'Cumaná', 'Guanare', 'La Guaira', 'Los Teques', 'Maracaibo', 'Maracay',
  'Maturín', 'Mérida', 'Porlamar', 'Puerto Ayacucho', 'Puerto La Cruz', 'Puerto Ordaz',
  'San Carlos', 'San Cristóbal', 'San Felipe', 'San Fernando de Apure',
  'San Juan de los Morros', 'Trujillo', 'Tucupita', 'Valencia', 'Valera',
];

export function openLocationPicker() {
  openModal({
    title: 'Selecciona tu ciudad',
    bodyHtml: `<div class="option-list" id="city-option-list">${CITIES.map(cityOptionHtml).join('')}</div>`,
    onMount: (body) => {
      bindCityOptions(body);
      loadRealCities(body);
    },
  });
}

function cityOptionHtml(c) {
  return `<button type="button" class="option-list__item" data-city="${escapeHtml(c)}">${escapeHtml(c)}, Venezuela</button>`;
}

function bindCityOptions(scope) {
  scope.querySelectorAll('[data-city]:not([data-bound])').forEach((btn) => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      locationService.setCity(btn.dataset.city);
      closeModal();
      // Re-renderiza la pantalla actual (misma ruta/filtros) con el nuevo
      // filtro de ciudad ya aplicado — navigate() a la misma ruta dispara
      // un hashchange manual, ver js/nav.js.
      navigate(location.hash || '/');
    });
  });
}

// Además de la lista fija de arriba (CITIES), suma las ciudades donde ya
// hay tiendas reales verificadas — así la lista crece sola a medida que
// se registran tiendas nuevas, sin tener que tocar código (ver
// storeService.getCities()). Se pide después de abrir el modal, no antes,
// para que el selector abra al instante sin esperar la red.
async function loadRealCities(body) {
  const real = await storeService.getCities();
  const list = body.querySelector('#city-option-list');
  if (!list || !document.body.contains(list)) return; // el modal ya se cerró
  const known = new Set(CITIES.map((c) => c.toLowerCase()));
  const extra = real.filter((c) => c && !known.has(c.toLowerCase()));
  if (!extra.length) return;
  list.insertAdjacentHTML('beforeend', extra.map(cityOptionHtml).join(''));
  bindCityOptions(list);
}

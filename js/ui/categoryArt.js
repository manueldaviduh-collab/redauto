// Imagen "hero" de categoría: sustituye la foto de un producto cuando la
// tienda todavía no subió ninguna (ver productTile() en components.js).
// Antes era una ilustración SVG dibujada a mano (js/ui/productArt.js,
// retirado en este cambio); ahora son los renders 3D fotorrealistas WebP
// de la Guía Visual Oficial de RedAuto — ver assets/category-art/README.md
// para el nombre de archivo exacto que espera cada categoría y las
// especificaciones de producción (cámara, luz, formato).
//
// Mientras el render definitivo de una categoría no exista todavía (o si
// falla al cargar por cualquier otro motivo), el <img> cae solo al ícono de
// línea de esa categoría — el mismo que ya se usa en la grilla de
// categorías de Inicio — así nunca se muestra el hueco de imagen rota del
// navegador.
import { icon } from './icons.js';
import { getCategoryById } from '../data/categories.js';

const BASE_PATH = 'assets/category-art';

export function categoryArt(categoryId) {
  const category = getCategoryById(categoryId) || getCategoryById('motor');
  const id = category.id;
  return `<img class="category-art" data-category-icon="${category.icon}"
    src="${BASE_PATH}/${id}-512.webp"
    srcset="${BASE_PATH}/${id}-256.webp 256w, ${BASE_PATH}/${id}-512.webp 512w"
    sizes="(min-width: 640px) 256px, 45vw"
    width="512" height="512" alt="" loading="lazy" decoding="async" />`;
}

// El evento 'error' de <img> no burbujea, pero sí se puede capturar desde
// un ancestro en la fase de captura — así un solo listener a nivel de
// documento cubre cualquier <img class="category-art"> que se inserte,
// sin tener que enlazar nada por cada tile ni tocar quien llama a
// categoryArt(). Se registra una sola vez al importar este módulo.
let fallbackBound = false;
function bindCategoryArtFallback() {
  if (fallbackBound) return;
  fallbackBound = true;
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('category-art')) return;
    img.outerHTML = `<span class="category-art category-art--fallback" aria-hidden="true">${icon(img.dataset.categoryIcon, { size: 96 })}</span>`;
  }, true);
}
bindCategoryArtFallback();

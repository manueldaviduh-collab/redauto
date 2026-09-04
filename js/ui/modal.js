import { icon } from './icons.js';

function getRoot() {
  return document.getElementById('modal-root');
}

// Bottom sheet genérico reutilizado por filtros, notificaciones y el
// formulario de producto del panel de vendedor. `onMount` recibe el
// contenedor ya insertado en el DOM para poder enlazar eventos.
export function openModal({ title, bodyHtml, onMount, ariaLabel }) {
  const root = getRoot();
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay" data-close-modal>
      <div class="modal-sheet" role="dialog" aria-modal="true" aria-label="${ariaLabel || title || 'Diálogo'}">
        <div class="modal-sheet__handle" aria-hidden="true"></div>
        <div class="modal-sheet__header">
          <h2 class="modal-sheet__title">${title || ''}</h2>
          <button type="button" class="icon-btn" data-close-modal aria-label="Cerrar">${icon('x', { size: 20 })}</button>
        </div>
        <div class="modal-sheet__body">${bodyHtml}</div>
      </div>
    </div>
  `;
  root.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', (e) => {
      // Al fondo (overlay) sólo cierra si el clic fue directo ahí (no si
      // "burbujeó" desde el sheet). Al botón "X" sí lo hace siempre —
      // e.target puede ser el ícono SVG de adentro, no el <button> en sí,
      // así que exigir e.target === el ahí dejaba el botón sin responder.
      if (el.classList.contains('modal-overlay') && e.target !== el) return;
      closeModal();
    });
  });
  const sheet = root.querySelector('.modal-sheet');
  sheet?.addEventListener('click', (e) => e.stopPropagation());
  if (onMount) onMount(root.querySelector('.modal-sheet__body'));
  document.body.classList.add('no-scroll');
}

export function closeModal() {
  const root = getRoot();
  if (root) root.innerHTML = '';
  document.body.classList.remove('no-scroll');
}

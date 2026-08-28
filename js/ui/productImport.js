import { icon } from './icons.js';
import { escapeHtml } from './components.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { api, ApiError } from '../services/api.js';

// Modal de importación masiva por Excel: descargar plantilla → subir →
// vista previa con errores por fila → confirmar. El mismo archivo se
// manda dos veces (preview y commit) — ver server/src/routes/productsImport.js
// para por qué (así el backend nunca importa algo que no se le mostró
// primero al vendedor).
export function openImportModal({ refresh }) {
  let selectedFile = null;
  let previewResult = null;

  openModal({
    title: 'Importar productos por Excel',
    ariaLabel: 'Importar productos por Excel',
    bodyHtml: `
      <div class="import-flow">
        <p class="detail-block__text">Descarga la plantilla oficial, complétala con tu inventario (puedes repetir el SKU en varias filas si un producto sirve para más de un vehículo) y súbela de vuelta.</p>
        <button type="button" class="btn btn--outline btn--block" id="btn-download-template">${icon('package', { size: 16 })} Descargar plantilla oficial (.xlsx)</button>

        <label class="field" style="margin-top:14px">
          <span class="field__label">Subir archivo completado</span>
          <input type="file" id="import-file-input" accept=".xlsx,.csv" />
        </label>

        <div id="import-preview"></div>
      </div>
    `,
    onMount: (body) => {
      body.querySelector('#btn-download-template')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await api.download('/products/import/template', 'redauto-plantilla-productos.xlsx');
        } catch (err) {
          showToast(err?.message || 'No se pudo descargar la plantilla.', 'error');
        } finally {
          btn.disabled = false;
        }
      });

      const previewEl = body.querySelector('#import-preview');
      body.querySelector('#import-file-input')?.addEventListener('change', async (e) => {
        selectedFile = e.target.files[0] || null;
        previewResult = null;
        if (!selectedFile) { previewEl.innerHTML = ''; return; }

        previewEl.innerHTML = `<p class="detail-block__text">${icon('info', { size: 14 })} Revisando el archivo…</p>`;
        try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          previewResult = await api.upload('/products/import/preview', formData, { auth: true });
          renderPreview(previewEl, previewResult, { onConfirm: () => commitImport({ body, previewEl, refresh, selectedFile }) });
        } catch (err) {
          previewEl.innerHTML = `<p class="field-error">${escapeHtml(err instanceof ApiError ? err.message : 'No se pudo leer el archivo.')}</p>`;
        }
      });
    },
  });
}

function renderPreview(previewEl, result, { onConfirm }) {
  const { products = [], errors = [] } = result;
  previewEl.innerHTML = `
    <div class="import-summary">
      <div class="stat-row">
        <div class="stat-card"><span class="stat-card__value">${products.length}</span><span class="stat-card__label">Productos listos</span></div>
        <div class="stat-card"><span class="stat-card__value">${errors.length}</span><span class="stat-card__label">Filas con error</span></div>
      </div>
    </div>
    ${errors.length ? `
      <details class="import-errors">
        <summary>Ver errores (${errors.length})</summary>
        <ul class="compat-list">
          ${errors.map((e) => `<li>Fila ${e.row}: ${escapeHtml(e.message)}</li>`).join('')}
        </ul>
      </details>
    ` : ''}
    ${products.length ? `
      <button type="button" class="btn btn--primary btn--block" id="btn-confirm-import">
        ${icon('check', { size: 16 })} Importar ${products.length} producto${products.length === 1 ? '' : 's'}
      </button>
    ` : `<p class="field-error">No hay productos válidos para importar. Corrige el archivo y vuelve a subirlo.</p>`}
  `;
  previewEl.querySelector('#btn-confirm-import')?.addEventListener('click', onConfirm);
}

async function commitImport({ previewEl, refresh, selectedFile }) {
  const btn = previewEl.querySelector('#btn-confirm-import');
  if (btn) btn.disabled = true;
  try {
    const formData = new FormData();
    formData.append('file', selectedFile);
    const result = await api.upload('/products/import/commit', formData, { auth: true });
    closeModal();
    showToast(`${result.imported} producto${result.imported === 1 ? '' : 's'} importado${result.imported === 1 ? '' : 's'}`, 'success');
    refresh();
  } catch (err) {
    if (btn) btn.disabled = false;
    showToast(err instanceof ApiError ? err.message : 'No se pudo completar la importación.', 'error');
  }
}

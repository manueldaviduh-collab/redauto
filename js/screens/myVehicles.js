import { icon } from '../ui/icons.js';
import { backHeaderHtml, escapeHtml, emptyState } from '../ui/components.js';
import { vehicleService } from '../services/vehicleService.js';
import { openModal, closeModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { navigate } from '../nav.js';

export async function render(container) {
  paint(container);
}

function paint(container) {
  const garage = vehicleService.getGarage();
  const activeId = vehicleService.getActiveId();

  container.innerHTML = `
    ${backHeaderHtml('Mis vehículos')}
    <div class="screen-pad">
      <p class="trust-line trust-line--tight">${icon('info', { size: 15 })} Guarda tus vehículos para ver de inmediato qué repuestos son compatibles.</p>
      <div class="vehicle-list" id="vehicle-list">
        ${garage.length ? garage.map((v) => vehicleCard(v, v.id === activeId)).join('') : emptyState({
          iconName: 'car',
          title: 'Aún no tienes vehículos guardados',
          message: 'Agrega marca, modelo y año para empezar a ver compatibilidad automática.',
        })}
      </div>
      <button type="button" class="btn btn--primary btn--block" id="btn-add-vehicle">${icon('plusCircle', { size: 17 })} Agregar vehículo</button>
    </div>
  `;

  bindBack(container);
  container.querySelector('#btn-add-vehicle')?.addEventListener('click', () => openVehicleForm(container));

  container.querySelectorAll('[data-set-active]').forEach((btn) => {
    btn.addEventListener('click', () => {
      vehicleService.setActive(btn.dataset.setActive);
      showToast('Vehículo activo actualizado', 'success');
      paint(container);
    });
  });
  container.querySelectorAll('[data-remove-vehicle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      vehicleService.removeVehicle(btn.dataset.removeVehicle);
      showToast('Vehículo eliminado', 'info');
      paint(container);
    });
  });
}

function vehicleCard(v, isActive) {
  return `
  <article class="vehicle-card ${isActive ? 'is-active' : ''}">
    <span class="vehicle-card__icon">${icon('car', { size: 22 })}</span>
    <div class="vehicle-card__body">
      <p class="vehicle-card__title">${escapeHtml(v.brand)} ${escapeHtml(v.model)} ${v.year}</p>
      <p class="vehicle-card__meta">${v.engine ? `Motor ${escapeHtml(v.engine)}` : 'Sin datos de motor'}</p>
      ${isActive ? `<span class="badge badge--verified">${icon('check', { size: 11 })} Vehículo activo</span>` : ''}
    </div>
    <div class="vehicle-card__actions">
      ${!isActive ? `<button type="button" class="btn btn--ghost btn--sm" data-set-active="${v.id}">Usar este</button>` : ''}
      <button type="button" class="icon-btn" data-remove-vehicle="${v.id}" aria-label="Eliminar vehículo">${icon('trash', { size: 16 })}</button>
    </div>
  </article>`;
}

function openVehicleForm(container) {
  const brands = vehicleService.getBrands();
  openModal({
    title: 'Agregar vehículo',
    bodyHtml: `
      <form id="vehicle-form" class="stacked-form">
        <label class="field">
          <span class="field__label">Marca</span>
          <select name="brand" id="veh-form-brand" required>
            <option value="">Selecciona marca</option>
            ${brands.map((b) => `<option value="${b}">${b}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field__label">Modelo</span>
          <select name="model" id="veh-form-model" required>
            <option value="">Selecciona marca primero</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Año</span>
          <select name="year" required>
            <option value="">Selecciona año</option>
            ${vehicleService.getYears().map((y) => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field__label">Motor (opcional)</span>
          <input type="text" name="engine" placeholder="Ej. 1.8L, 2.0 Turbo" />
        </label>
        <button type="submit" class="btn btn--primary btn--block">Guardar vehículo</button>
      </form>
    `,
    onMount: (body) => {
      const brandEl = body.querySelector('#veh-form-brand');
      const modelEl = body.querySelector('#veh-form-model');
      brandEl.addEventListener('change', () => {
        const models = vehicleService.getModels(brandEl.value);
        modelEl.innerHTML = models.length
          ? models.map((m) => `<option value="${m}">${m}</option>`).join('')
          : '<option value="">Sin modelos</option>';
      });
      body.querySelector('#vehicle-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        const brand = data.get('brand');
        const model = data.get('model');
        const year = data.get('year');
        if (!brand || !model || !year) return;
        vehicleService.addVehicle({ brand, model, year, engine: data.get('engine') });
        closeModal();
        showToast('Vehículo agregado a tu garage', 'success');
        paint(container);
      });
    },
  });
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : navigate('/perfil');
  });
}

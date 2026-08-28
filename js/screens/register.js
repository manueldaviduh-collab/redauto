import { icon } from '../ui/icons.js';
import { backHeaderHtml, escapeHtml } from '../ui/components.js';
import { authService } from '../services/authService.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';
import { categories } from '../data/categories.js';
import { venezuelaStates } from '../data/venezuelaStates.js';

export async function render(container, { query }) {
  const next = query.next || '/';

  container.innerHTML = `
    ${backHeaderHtml('Crear cuenta')}
    <div class="screen-pad auth-screen">
      <p class="auth-screen__subtitle">Crea tu cuenta para comprar repuestos en tiendas verificadas de todo el país.</p>

      <form id="register-form" class="stacked-form" novalidate>
        <label class="field">
          <span class="field__label">Nombre completo</span>
          <input type="text" name="name" required minlength="2" autocomplete="name" />
        </label>
        <label class="field">
          <span class="field__label">Correo electrónico</span>
          <input type="email" name="email" required autocomplete="email" />
        </label>
        <label class="field">
          <span class="field__label">Teléfono</span>
          <input type="tel" name="phone" placeholder="+58 412-0000000" autocomplete="tel" />
        </label>
        <label class="field">
          <span class="field__label">Ciudad</span>
          <input type="text" name="city" placeholder="Caracas" />
        </label>
        <label class="field">
          <span class="field__label">Contraseña</span>
          <input type="password" name="password" required minlength="6" autocomplete="new-password" />
        </label>
        <label class="field">
          <span class="field__label">Confirmar contraseña</span>
          <input type="password" name="password2" required minlength="6" autocomplete="new-password" />
        </label>

        <label class="checkbox-field">
          <input type="checkbox" id="wants-store" name="wantsStore" />
          <span>Quiero vender en RedAuto (registrar mi tienda)</span>
        </label>

        <div id="store-fields" hidden>
          <p class="trust-line trust-line--tight">${icon('info', { size: 15 })} Tu tienda queda pendiente de verificación — un administrador la revisa antes de que sea visible para compradores. Mientras tanto ya puedes cargar tu inventario completo.</p>
          <label class="field">
            <span class="field__label">Nombre de tu tienda</span>
            <input type="text" name="storeName" minlength="2" placeholder="Ej. Repuestos Duarte C.A." />
          </label>
          <label class="field">
            <span class="field__label">RIF</span>
            <input type="text" name="rif" placeholder="J-12345678-9" />
          </label>
          <label class="field">
            <span class="field__label">Nombre del responsable</span>
            <input type="text" name="responsibleName" placeholder="Nombre y apellido" />
          </label>
          <label class="field">
            <span class="field__label">WhatsApp</span>
            <input type="tel" name="whatsapp" placeholder="+58 412-0000000" />
          </label>
          <label class="field">
            <span class="field__label">Dirección</span>
            <input type="text" name="address" placeholder="Av., calle, local…" />
          </label>
          <p class="field-hint">Usamos la Ciudad que pusiste arriba también como ciudad de la tienda.</p>
          <label class="field">
            <span class="field__label">Estado</span>
            <select name="state">
              <option value="">Selecciona estado</option>
              ${venezuelaStates.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
            </select>
          </label>
          <div class="field">
            <span class="field__label">Categorías de productos que vende</span>
            <div class="filters-form__pills" id="register-category-pills">
              ${categories.map((c) => `<button type="button" class="pill" data-category-id="${c.id}">${escapeHtml(c.name)}</button>`).join('')}
            </div>
          </div>
        </div>

        <p class="field-error" id="register-error" hidden></p>
        <button type="submit" class="btn btn--primary btn--block">Crear cuenta</button>
      </form>

      <p class="auth-switch">¿Ya tienes cuenta? <a href="#/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}">Inicia sesión</a></p>
    </div>
  `;

  bindBack(container);

  const wantsStoreCheckbox = container.querySelector('#wants-store');
  const storeFields = container.querySelector('#store-fields');
  const storeNameInput = storeFields.querySelector('input[name="storeName"]');
  wantsStoreCheckbox?.addEventListener('change', () => {
    storeFields.hidden = !wantsStoreCheckbox.checked;
    storeNameInput.required = wantsStoreCheckbox.checked;
    if (!wantsStoreCheckbox.checked) storeNameInput.value = '';
  });

  const categoryPills = container.querySelector('#register-category-pills');
  const selectedCategoryIds = new Set();
  categoryPills?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category-id]');
    if (!btn) return;
    const id = btn.dataset.categoryId;
    if (selectedCategoryIds.has(id)) {
      selectedCategoryIds.delete(id);
      btn.classList.remove('is-selected');
    } else {
      selectedCategoryIds.add(id);
      btn.classList.add('is-selected');
    }
  });

  container.querySelector('#register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = container.querySelector('#register-error');
    errorEl.hidden = true;
    const data = new FormData(form);

    if (data.get('password') !== data.get('password2')) {
      errorEl.textContent = 'Las contraseñas no coinciden.';
      errorEl.hidden = false;
      return;
    }
    const wantsStore = wantsStoreCheckbox?.checked;
    if (wantsStore) {
      const required = {
        storeName: 'Ingresa el nombre de tu tienda.',
        rif: 'Ingresa el RIF de tu tienda.',
        responsibleName: 'Ingresa el nombre del responsable.',
        address: 'Ingresa la dirección de tu tienda.',
        city: 'Ingresa la ciudad.',
        state: 'Selecciona el estado.',
      };
      for (const [field, message] of Object.entries(required)) {
        if (!String(data.get(field) || '').trim()) {
          errorEl.textContent = message;
          errorEl.hidden = false;
          return;
        }
      }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await authService.register({
      name: data.get('name'),
      email: data.get('email'),
      password: data.get('password'),
      phone: data.get('phone'),
      city: data.get('city'),
      storeName: wantsStore ? data.get('storeName') : undefined,
      rif: wantsStore ? data.get('rif') : undefined,
      responsibleName: wantsStore ? data.get('responsibleName') : undefined,
      whatsapp: wantsStore ? data.get('whatsapp') : undefined,
      address: wantsStore ? data.get('address') : undefined,
      state: wantsStore ? data.get('state') : undefined,
      categoryIds: wantsStore ? [...selectedCategoryIds] : undefined,
    });
    submitBtn.disabled = false;

    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    showToast(`Cuenta creada. ¡Bienvenido, ${result.user.name.split(' ')[0]}!`, 'success');
    navigate(wantsStore ? '/vendedor' : next);
  });
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : navigate('/login');
  });
}

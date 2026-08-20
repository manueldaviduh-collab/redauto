import { icon } from '../ui/icons.js';
import { backHeaderHtml } from '../ui/components.js';
import { authService } from '../services/authService.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';

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
        <p class="field-error" id="register-error" hidden></p>
        <button type="submit" class="btn btn--primary btn--block">Crear cuenta</button>
      </form>

      <p class="auth-switch">¿Ya tienes cuenta? <a href="#/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}">Inicia sesión</a></p>
    </div>
  `;

  bindBack(container);

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

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await authService.register({
      name: data.get('name'),
      email: data.get('email'),
      password: data.get('password'),
      phone: data.get('phone'),
      city: data.get('city'),
    });
    submitBtn.disabled = false;

    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    showToast(`Cuenta creada. ¡Bienvenido, ${result.user.name.split(' ')[0]}!`, 'success');
    navigate(next);
  });
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : navigate('/login');
  });
}

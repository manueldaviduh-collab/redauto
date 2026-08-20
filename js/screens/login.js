import { icon } from '../ui/icons.js';
import { backHeaderHtml } from '../ui/components.js';
import { authService } from '../services/authService.js';
import { navigate } from '../nav.js';
import { showToast } from '../ui/toast.js';

export async function render(container, { query }) {
  const next = query.next || '/';

  container.innerHTML = `
    ${backHeaderHtml('Iniciar sesión')}
    <div class="screen-pad auth-screen">
      <div class="brand-lockup brand-lockup--center">
        <span class="brand-mark" aria-hidden="true">R</span>
        <span class="brand-word">Red<span class="accent">Auto</span></span>
      </div>
      <p class="auth-screen__subtitle">Inicia sesión para comprar y hacer seguimiento de tus pedidos.</p>

      <form id="login-form" class="stacked-form" novalidate>
        <label class="field">
          <span class="field__label">Correo electrónico</span>
          <input type="email" name="email" required autocomplete="email" placeholder="tucorreo@ejemplo.com" />
        </label>
        <label class="field">
          <span class="field__label">Contraseña</span>
          <div class="field__password">
            <input type="password" name="password" required autocomplete="current-password" minlength="6" id="login-password" />
            <button type="button" class="icon-btn" id="toggle-password" aria-label="Mostrar contraseña">${icon('eye', { size: 18 })}</button>
          </div>
        </label>
        <p class="field-error" id="login-error" hidden></p>
        <button type="submit" class="btn btn--primary btn--block">Iniciar sesión</button>
      </form>

      <p class="auth-switch">¿No tienes cuenta? <a href="#/registro${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}">Regístrate</a></p>

      <div class="demo-hint">
        <p class="demo-hint__title">${icon('info', { size: 14 })} Cuentas demo (MVP sin backend)</p>
        <p>Comprador: <code>demo@redauto.com</code> / <code>demo123</code></p>
        <p>Tienda: <code>tienda@redauto.com</code> / <code>demo123</code></p>
      </div>
    </div>
  `;

  bindBack(container);
  bindPasswordToggle(container);

  container.querySelector('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = container.querySelector('#login-error');
    errorEl.hidden = true;
    const data = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const result = await authService.login(data.get('email'), data.get('password'));
    submitBtn.disabled = false;
    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    showToast(`Bienvenido, ${result.user.name.split(' ')[0]}`, 'success');
    navigate(next);
  });
}

function bindPasswordToggle(container) {
  const btn = container.querySelector('#toggle-password');
  const input = container.querySelector('#login-password');
  btn?.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = icon(isPassword ? 'eyeOff' : 'eye', { size: 18 });
  });
}

function bindBack(container) {
  container.querySelector('[data-action="go-back"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    history.length > 1 ? history.back() : navigate('/');
  });
}

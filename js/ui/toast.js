let root = null;

function getRoot() {
  if (!root) root = document.getElementById('toast-root');
  return root;
}

export function showToast(message, type = 'success') {
  const container = getRoot();
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--visible'));
  setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

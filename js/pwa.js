// Registro del service worker (sw.js). Deliberadamente separado de
// app.js/router.js: esto es configuración de "instalar y actualizar la PWA",
// no lógica de producto — ver docs/ARQUITECTURA.md. No importa nada de
// services/ ni screens/, y nada de ahí importa este archivo.
if ('serviceWorker' in navigator) {
  // Si ya había un controller al cargar, esta carga la sirvió un service
  // worker previo — un controllerchange después de eso es una actualización
  // real. Si no había ninguno (primera visita / primera instalación), el
  // controllerchange que dispara `clients.claim()` no es una actualización:
  // esta misma carga ya vino fresca de la red, así que no hay que recargar.
  const hadControllerOnLoad = !!navigator.serviceWorker.controller;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue funcionando igual, solo sin caché
      // offline ni actualización en segundo plano — nunca bloquear la app.
    });
  });

  // Cuando una versión nueva de sw.js se instala y toma control, recarga
  // una sola vez para que la pestaña abierta pase a la versión nueva sin
  // que el usuario tenga que cerrar y reabrir la app manualmente.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerOnLoad || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

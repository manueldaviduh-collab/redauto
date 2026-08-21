# RedAuto — Marketplace de autopartes (MVP)

RedAuto conecta compradores con **tiendas verificadas de autopartes** en Venezuela.
El usuario encuentra el repuesto correcto para su vehículo y compra con
confianza; el vendedor gestiona su catálogo desde un panel propio. Este MVP
no incluye talleres, mecánicos ni reservas de servicio: el foco es 100%
repuestos + tiendas verificadas.

## Cómo ejecutar el proyecto

Es una app estática (HTML/CSS/JS con módulos ES nativos, sin build step).
Los módulos ES requieren servirse por HTTP (no funcionan abriendo el archivo
directamente con `file://`). Desde la raíz del proyecto:

```bash
# opción 1
python3 -m http.server 8080

# opción 2 (si tienes Node)
npx serve .
```

Luego abre `http://localhost:8080`. Para simular un teléfono, usa las
herramientas de desarrollador del navegador (375–430px de ancho). El layout
también responde en tablet/escritorio (sidebar de navegación desde 1024px).

### Cuentas de demostración

No hay backend de autenticación: `authService` valida contra estas cuentas
(y contra las que se registren desde la app, guardadas en `localStorage`).

| Rol       | Correo                | Contraseña |
|-----------|------------------------|------------|
| Comprador | `demo@redauto.com`     | `demo123`  |
| Tienda    | `tienda@redauto.com`   | `demo123`  |

## Arquitectura

```
index.html          Shell de la app (splash, header/nav/toast/modal son contenedores fijos)
assets/              logo-mark.png / favicon.png (recorte del ícono de marca provisto)
css/styles.css       Sistema de diseño: tokens de color/tipografía/sombra + componentes
js/
  app.js             Punto de entrada: arranca el router y controla el splash screen
  router.js           Router hash-based, mapea rutas -> pantallas, transición de entrada
  nav.js               navigate()/parseHash(), sin dependencias circulares
  data/                Datos centralizados (mock), una fuente de verdad por dominio
    categories.js, vehicles.js, stores.js, products.js, users.js,
    notifications.js, reviews.js
  services/            Capa de negocio — el único punto de acceso a los datos
    storage.js          Envoltorio sobre localStorage (namespacing + try/catch)
    productService.js   Búsqueda/filtros, compatibilidad, estado de inventario,
                         catálogo + overrides del vendedor
    storeService.js      Tiendas verificadas
    categoryService.js
    vehicleService.js    "Mis Vehículos": garage (CRUD) + vehículo activo
    cartService.js        Carrito (localStorage) + evento global de cambio
    favoritesService.js   Favoritos de productos y de tiendas
    authService.js         Sesión demo + registro (localStorage)
    orderService.js         Historial de pedidos + checkout (sin pagos reales)
    sellerService.js         Agrega datos para el panel de vendedor
    notificationService.js   Centro de notificaciones (leído/no leído)
  ui/                   Presentación reutilizable
    icons.js, productArt.js (ilustraciones de producto), components.js,
    toast.js, modal.js, chat.js ("Preguntar a la tienda")
  screens/              Una pantalla = una función render(container, params)
    home.js, search.js, product.js, stores.js, storeDetail.js,
    cart.js, checkout.js, login.js, register.js, profile.js, seller.js,
    myVehicles.js, favorites.js, notifications.js
```

**Por qué esta forma:** cada pantalla sólo habla con los `services/`, nunca
importa `data/` directamente (salvo catálogos de sólo lectura como
categorías/vehículos). Eso significa que reemplazar `productService.search()`
por un `fetch('/api/products/search')`, o `authService.login()` por una
llamada a un backend real, no debería tocar ninguna pantalla.

## Flujos funcionales implementados

1. **Splash screen** — logo con glow rojo y barra de progreso (~1.7s) antes de
   entrar a la app.
2. **Inicio** — buscador, sección "Mis vehículos" (chips del garage o CTA para
   agregar el primero), categorías, productos destacados y tiendas
   verificadas, con estados de carga (skeletons) reales.
3. **Mis Vehículos** — garage con alta/baja de vehículos (marca, modelo, año,
   motor opcional) y selección de vehículo activo. El vehículo activo impulsa
   la **compatibilidad inteligente**: un badge "✅ Compatible con tu Toyota
   Corolla 2018" aparece en tarjetas de producto, resultados de búsqueda y el
   detalle de producto (con aviso si no coincide), además del listado
   completo de rangos de compatibilidad.
4. **Búsqueda** — texto libre + filtros (vehículo, categoría, disponibilidad,
   original/alternativo, rango de precio) en una hoja modal; resultados,
   estado vacío y estado "sin resultados" funcionales; la URL (`#/buscar?...`)
   es la fuente de verdad de los filtros, por lo que es compartible/enlazable.
5. **Detalle de producto** — imagen tipo ficha de marketplace (fondo blanco),
   precio, estado de inventario en 3 niveles (🟢 Disponible / 🟡 Últimas
   unidades / 🔴 Agotado), opciones de entrega, descripción, compatibilidad,
   tienda vendedora con badge de verificación, botón **"Preguntar a la
   tienda"** (chat, ver abajo), selector de cantidad, agregar al carrito,
   comprar ahora y reseñas de muestra.
6. **Tiendas verificadas** — listado con búsqueda por nombre/ciudad y perfil
   de tienda (cobertura, calificación, ventas, horario, tiempo de respuesta,
   entrega/retiro, catálogo completo, favorito ⭐), con "Ver catálogo" como
   CTA principal y el chat como vía preferida de contacto.
7. **Chat "Preguntar a la tienda"** — resuelve la duda que frena la compra sin
   sacar al usuario de RedAuto: preguntas rápidas ("¿Le sirve a mi
   [vehículo]?", "¿Tienen disponible?", "¿Es original?", "¿Cuánto tarda?",
   "¿Puedo retirarlo hoy?") con respuestas generadas a partir de los datos
   reales del producto/tienda (compatibilidad, stock, tipo, entrega), más un
   campo de texto libre. Resuelta la duda, aparece el CTA natural: **Agregar
   al carrito** / **Comprar ahora** (o **Ver catálogo** si el chat es sobre la
   tienda en general). WhatsApp y llamada telefónica siguen disponibles, pero
   como opción secundaria discreta debajo del chat — nunca como CTA
   principal, para no sacar al comprador de la plataforma.
8. **Favoritos** — productos (❤️) y tiendas (⭐) guardados, con pantalla propia
   por pestañas accesible desde Perfil.
9. **Centro de notificaciones** — pantalla con pedidos, ofertas y novedades,
   estado leído/no leído persistido.
10. **Carrito y checkout** — agregar/quitar/actualizar cantidades, persistido
    en `localStorage`; CTA del carrito es **"Continuar al pago"** y el de
    checkout es específico, **"Pagar $XX.XX"** (nunca un "Continuar"
    ambiguo). Checkout exige sesión iniciada, pide datos de entrega y crea un
    pedido en estado explícito **"Pendiente de pago (MVP)"** — no se simula
    ningún pago exitoso; una nota de "Protección de compra RedAuto" refuerza
    que el pedido y el historial quedan dentro de la plataforma.
11. **Cuenta** — login/registro con validación de campos, sesión demo
    persistida, perfil con historial de pedidos y accesos a vehículos/
    favoritos/notificaciones.
12. **Panel de vendedor** — sólo accesible con una cuenta de rol `vendedor`:
    resumen de ventas (KPIs calculados en vivo), pedidos de la tienda,
    inventario con alta/edición de productos (persistido en `localStorage`) y
    estado de verificación.

## Qué es simulado localmente vs. qué está listo para backend

**Simulado en el navegador (sin servidor):**
- Sesión de usuario y registro (`authService` + `localStorage`).
- Carrito, favoritos (productos y tiendas) y garage de vehículos
  (`localStorage`).
- Pedidos creados en checkout (no hay pasarela de pago real conectada).
- Alta/edición de productos del panel de vendedor (se guardan como
  "overrides" sobre el catálogo base, en `localStorage`).
- Verificación de tienda: es un dato fijo de demostración, no un flujo de
  validación real.
- Notificaciones y reseñas: datos de muestra fijos (no hay backend de
  notificaciones push ni sistema de reseñas de compradores reales todavía).
- Chat "Preguntar a la tienda": las respuestas se generan en el cliente a
  partir de los datos reales del producto/tienda (no hay mensajería real ni
  un vendedor humano respondiendo). WhatsApp/llamada quedan como respaldo
  secundario y usan `wa.me`/`tel:` reales.

**Listo para conectar a backend sin rediseñar pantallas:**
- Cada `services/*.js` expone funciones `async` con un contrato estable
  (`search`, `getById`, `checkout`, `login`, etc.) pensado para volverse un
  `fetch` a una API real.
- `productService` ya está separado en catálogo base + overrides, análogo a
  "catálogo global" vs. "inventario por tienda" en un backend real.
- `orderService.checkout()` recibe los datos de envío y devuelve un pedido
  con estado explícito, listo para engancharse a un proveedor de pagos y a
  cálculo de envío real.
- `sellerService.getDashboard()` es el único punto de entrada para las
  métricas del panel — puede pasar a leer de `/api/stores/:id/dashboard` sin
  tocar `seller.js`.

## Notas de diseño

- Paleta: negro/grafito (`#0c0c0e`, `#17171a`), rojo de marca `#E53935`,
  blanco de contraste. Tipografía Poppins (Google Fonts, con fallback a
  fuentes del sistema si no hay red).
- Mobile-first con navegación inferior fija (Inicio, Buscar, Carrito,
  Tiendas, Perfil); desde 1024px la navegación pasa a un riel lateral y las
  grillas de producto/tienda ganan columnas, sin perder la jerarquía
  "buscar repuesto es la acción principal". Transición de entrada suave
  entre pantallas y microinteracciones (hover/tap) en tarjetas y botones.
- **Imágenes de producto:** no hay fotografía real disponible (sin banco de
  imágenes con licencia ni generador de imágenes en este proyecto). Se usa
  una ilustración vectorial propia por categoría (`js/ui/productArt.js`)
  sobre tarjeta blanca —fondo blanco puro, producto centrado, sin texto ni
  marcas de agua— como alternativa honesta a una foto de estudio real.
- El logo es el ícono de marca provisto por el usuario (recorte del archivo
  original en `assets/`), no una reinterpretación.
- **Principio de conversión:** toda la experiencia está pensada para que la
  compra se complete dentro de RedAuto (marketplace, no directorio). El CTA
  principal en producto y carrito siempre es Agregar al carrito/Comprar
  ahora/Continuar al pago/Pagar; el chat resuelve dudas sin sacar al usuario
  de la app; WhatsApp y llamada existen pero como opción secundaria y
  discreta, nunca como CTA principal.

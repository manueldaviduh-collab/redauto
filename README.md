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
index.html          Shell de la app (header/nav/toast/modal son contenedores fijos)
css/styles.css       Sistema de diseño: tokens de color/tipografía + componentes
js/
  app.js             Punto de entrada, arranca el router
  router.js           Router hash-based, mapea rutas -> pantallas
  nav.js               navigate()/parseHash(), sin dependencias circulares
  data/                Datos centralizados (mock), una fuente de verdad por dominio
    categories.js, vehicles.js, stores.js, products.js, users.js
  services/            Capa de negocio — el único punto de acceso a los datos
    storage.js          Envoltorio sobre localStorage (namespacing + try/catch)
    productService.js   Búsqueda/filtros, catálogo + overrides del vendedor
    storeService.js      Tiendas verificadas
    categoryService.js
    vehicleService.js    Catálogo marca/modelo/año + vehículo preferido
    cartService.js        Carrito (localStorage) + evento global de cambio
    favoritesService.js
    authService.js         Sesión demo + registro (localStorage)
    orderService.js         Historial de pedidos + checkout (sin pagos reales)
    sellerService.js         Agrega datos para el panel de vendedor
  ui/                   Presentación reutilizable
    icons.js, components.js, toast.js, modal.js
  screens/              Una pantalla = una función render(container, params)
    home.js, search.js, product.js, stores.js, storeDetail.js,
    cart.js, checkout.js, login.js, register.js, profile.js, seller.js
```

**Por qué esta forma:** cada pantalla sólo habla con los `services/`, nunca
importa `data/` directamente (salvo catálogos de sólo lectura como
categorías/vehículos). Eso significa que reemplazar `productService.search()`
por un `fetch('/api/products/search')`, o `authService.login()` por una
llamada a un backend real, no debería tocar ninguna pantalla.

## Flujos funcionales implementados

1. **Inicio** — buscador, selector de vehículo (marca/modelo/año), categorías,
   productos destacados y tiendas verificadas, con estados de carga
   (skeletons) reales mientras "llegan" los datos.
2. **Búsqueda** — texto libre + filtros (vehículo, categoría, disponibilidad,
   original/alternativo, rango de precio) en una hoja modal; resultados,
   estado vacío y estado "sin resultados" funcionales; la URL (`#/buscar?...`)
   es la fuente de verdad de los filtros, por lo que es compartible/enlazable.
3. **Detalle de producto** — imagen, precio, disponibilidad, descripción,
   compatibilidad, tienda vendedora con badge de verificación, selector de
   cantidad, agregar al carrito y comprar ahora.
4. **Tiendas verificadas** — listado con búsqueda por nombre/ciudad y perfil
   de tienda (cobertura, calificación, entrega/retiro, catálogo completo).
5. **Carrito y checkout** — agregar/quitar/actualizar cantidades, persistido
   en `localStorage`; checkout exige sesión iniciada, pide datos de entrega y
   crea un pedido en estado explícito **"Pendiente de pago (MVP)"** — no se
   simula ningún pago exitoso.
6. **Cuenta** — login/registro con validación de campos, sesión demo
   persistida, perfil con historial de pedidos y vehículo preferido.
7. **Panel de vendedor** — sólo accesible con una cuenta de rol `vendedor`:
   resumen de ventas (KPIs calculados en vivo), pedidos de la tienda,
   inventario con alta/edición de productos (persistido en `localStorage`) y
   estado de verificación.

## Qué es simulado localmente vs. qué está listo para backend

**Simulado en el navegador (sin servidor):**
- Sesión de usuario y registro (`authService` + `localStorage`).
- Carrito, favoritos y preferencia de vehículo (`localStorage`).
- Pedidos creados en checkout (no hay pasarela de pago real conectada).
- Alta/edición de productos del panel de vendedor (se guardan como
  "overrides" sobre el catálogo base, en `localStorage`).
- Verificación de tienda: es un dato fijo de demostración, no un flujo de
  validación real.

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
  "buscar repuesto es la acción principal".
- Los productos no tienen fotografía (no hay assets reales): se usa un tile
  con el ícono de categoría sobre degradado, consistente con la identidad de
  marca.

# RedAuto — Marketplace de autopartes (MVP)

RedAuto conecta compradores con **tiendas verificadas de autopartes** en Venezuela.
El usuario encuentra el repuesto correcto para su vehículo y compra con
confianza; el vendedor gestiona su catálogo desde un panel propio. Este MVP
no incluye talleres, mecánicos ni reservas de servicio: el foco es 100%
repuestos + tiendas verificadas.

## Documentación técnica

Este README cubre lo esencial para correr el proyecto y entender su
estado. La documentación de arquitectura completa vive en `docs/`:

- [`docs/PRINCIPIOS.md`](docs/PRINCIPIOS.md) — los principios de producto e
  ingeniería que cualquier decisión nueva debe respetar (o romper a
  propósito, no por accidente).
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — el documento central:
  stack tecnológico, estructura del proyecto, capas, autenticación,
  almacenamiento de imágenes, comunicación frontend↔backend, qué se rompe
  primero si esto crece, y cómo se conecta a un backend real sin
  reescribir pantallas.
- [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md) — qué hay hoy en
  `localStorage`, el esquema relacional objetivo, y el plan de migración.
- [`docs/DECISIONES.md`](docs/DECISIONES.md) — por qué se eligió cada
  pieza (sin framework, sin backend todavía, hash routing, etc.), qué
  alternativas se consideraron y cuándo conviene reconsiderar cada una.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — crecimiento por etapas, empezando
  por un piloto cerrado con tiendas reales.

> **Estado actual (se actualiza a medida que avanza el roadmap):** ya existe
> un backend real (`server/`) para cuenta de usuario/tienda y catálogo de
> productos — ver "Backend real" más abajo. Carrito, favoritos, garage de
> vehículos, notificaciones y checkout **todavía** viven en `localStorage`
> del navegador — ver `docs/ARQUITECTURA.md` §11 para el detalle completo
> de qué falta y `docs/ROADMAP.md` para el orden en que se resuelve.

## Cómo ejecutar el proyecto

El frontend es una app estática (HTML/CSS/JS con módulos ES nativos, sin
build step) que habla con el backend real en `server/` para cuenta de
usuario/tienda y productos. Para tener la app completa funcionando hacen
falta los dos:

### 1. Backend (`server/`)

Instrucciones completas, incluida cómo desplegarlo, en
[`server/README.md`](server/README.md). Resumen:

```bash
cd server
npm install
cp .env.example .env        # completa DATABASE_URL y JWT_SECRET
npm run migrate             # crea las tablas (sin datos de muestra)
npm start                   # http://localhost:4000
```

### 2. Frontend

Los módulos ES requieren servirse por HTTP (no funcionan abriendo el
archivo directamente con `file://`). Desde la raíz del proyecto:

```bash
# opción 1
python3 -m http.server 8080

# opción 2 (si tienes Node)
npx serve .
```

Luego abre `http://localhost:8080`. Si el backend corre en una URL distinta
a `http://localhost:4000/api`, cambia la línea `window.REDAUTO_API_URL` en
`index.html` — es la única línea que hay que tocar para apuntar a otro
backend (local, de prueba o de producción).

Para simular un teléfono, usa las herramientas de desarrollador del
navegador (375–430px de ancho). El layout también responde en
tablet/escritorio (sidebar de navegación desde 1024px).

### Cómo crear tu cuenta y tu tienda

No hay cuentas de demostración — nunca existieron en el backend real, y ya
se quitaron del frontend. Para vender en RedAuto:

1. Con el backend y el frontend corriendo, abre la app y ve a **Crear
   cuenta**.
2. Completa tus datos, marca la casilla **"Quiero vender en RedAuto
   (registrar mi tienda)"** y escribe el nombre de tu tienda.
3. Al confirmar quedas con una cuenta de vendedor real y tu tienda creada
   en la base de datos — la app te lleva directo al **Panel de vendedor**,
   pestaña Inventario, donde ya puedes agregar tus productos reales.

Una cuenta sin marcar esa casilla queda como comprador normal (igual que
cualquier persona real usando la app).

## Arquitectura

```
index.html          Shell de la app (splash, header/nav/toast/modal son contenedores fijos)
assets/              logo-mark.png / favicon.png (recorte del ícono de marca provisto)
css/styles.css       Sistema de diseño: tokens de color/tipografía/sombra + componentes
server/              Backend real (Node.js + Express + Postgres) — ver server/README.md
js/
  app.js             Punto de entrada: arranca el router y controla el splash screen
  config.js            URL del backend (window.REDAUTO_API_URL, ver index.html)
  router.js           Router hash-based, mapea rutas -> pantallas, transición de entrada
  nav.js               navigate()/parseHash(), sin dependencias circulares
  data/                Catálogo local de muestra (una fuente de verdad por dominio, no
                       remplaza al backend — ver services/*.js para qué ya es real)
    categories.js, vehicles.js, stores.js, products.js, users.js,
    notifications.js, reviews.js
  services/            Capa de negocio — el único punto de acceso a los datos
    storage.js          Envoltorio sobre localStorage (namespacing + try/catch)
    api.js                Cliente HTTP hacia el backend real (fetch + JWT + errores)
    productService.js   Búsqueda/filtros, compatibilidad, estado de inventario;
                         combina el catálogo local de muestra con el backend real
    storeService.js      Tiendas verificadas; combina local + backend real
    categoryService.js
    vehicleService.js    "Mis Vehículos": garage (CRUD) + vehículo activo (localStorage)
    cartService.js        Carrito (localStorage) + evento global de cambio
    favoritesService.js   Favoritos de productos y de tiendas (localStorage)
    authService.js         Cuenta y sesión reales contra el backend (JWT)
    orderService.js         Historial de pedidos + checkout (localStorage, sin pagos reales)
    sellerService.js         Panel de vendedor: lee/escribe productos reales en el backend
    notificationService.js   Centro de notificaciones (leído/no leído, localStorage)
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
11. **Cuenta** — login/registro **reales** contra el backend (contraseñas
    con hash, sesión con JWT), sin cuentas de demostración. Al registrarse,
    marcar "Quiero vender en RedAuto" crea además una tienda real asociada
    a la cuenta. Perfil con historial de pedidos y accesos a
    vehículos/favoritos/notificaciones.
12. **Panel de vendedor** — sólo accesible con una cuenta de rol `vendedor`:
    resumen de ventas, pedidos de la tienda, inventario con alta/edición de
    productos **persistidos en la base de datos real** (no en
    `localStorage`), y estado de verificación.

## Qué es real, qué es simulado, y qué está listo para conectarse

**Ya conectado a un backend real (`server/`, Postgres — sin datos de
muestra):**
- Cuenta de usuario y sesión (`authService`): contraseñas con hash
  (bcrypt), sesión con JWT. Sin cuentas de demostración.
- Registro de tienda (parte del mismo flujo de registro, con la opción
  "Quiero vender en RedAuto").
- Alta y edición de productos desde el panel de vendedor
  (`sellerService`/`productService`) — un producto que agregas ahí queda
  en la base de datos, visible para cualquiera que abra la app apuntando
  al mismo backend, no sólo en tu navegador.
- Navegación de compra (Inicio, Buscar, Tiendas, detalle de producto/
  tienda): combina el catálogo local de muestra con las tiendas/productos
  reales del backend, para que lo que subas aparezca en la misma
  navegación sin ninguna pantalla nueva.

**Todavía simulado en el navegador (sin servidor) — ver
`docs/ROADMAP.md` para el orden en que se conecta cada uno:**
- Carrito, favoritos (productos y tiendas) y garage de vehículos
  (`localStorage`).
- Pedidos creados en checkout: no hay pasarela de pago real conectada, y el
  pedido en sí todavía se guarda en `localStorage` (no en el backend) —
  siguiente paso natural una vez el flujo de compra esté validado.
- Verificación de tienda: toda tienda que se registra queda "verificada"
  automáticamente en el backend — no hay flujo de KYC real todavía (se
  declara así explícitamente, ver `server/README.md`).
- Notificaciones y reseñas: datos de muestra fijos.
- Chat "Preguntar a la tienda": las respuestas se generan en el cliente a
  partir de los datos reales del producto/tienda (no hay mensajería real ni
  un vendedor humano respondiendo). WhatsApp/llamada quedan como respaldo
  secundario y usan `wa.me`/`tel:` reales.

**Cómo sigue conectándose el resto sin rediseñar pantallas:** cada
`services/*.js` expone funciones `async` con un contrato estable, así que
mover carrito/pedidos/favoritos al backend es el mismo patrón ya usado para
auth y productos — reemplazar el cuerpo de la función, no su firma (ver
`docs/ARQUITECTURA.md` §12). El esquema relacional completo (incluidas las
tablas que el backend actual todavía no usa) está en
[`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md).

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

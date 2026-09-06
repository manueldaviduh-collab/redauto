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
> un backend real (`server/`) para cuenta de usuario/tienda, catálogo de
> productos y **pedidos** — ver "Backend real" más abajo. El carrito (antes
> de confirmar la compra), favoritos, garage de vehículos y notificaciones
> **todavía** viven en `localStorage` del navegador — ver
> `docs/ARQUITECTURA.md` §11 para el detalle completo de qué falta y
> `docs/ROADMAP.md` para el orden en que se resuelve.

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
   (registrar mi tienda)"** y llena el nombre de la tienda, RIF, nombre del
   responsable, WhatsApp, dirección, estado y las categorías que vendes.
3. Al confirmar quedas con una cuenta de vendedor real y tu tienda creada
   en la base de datos, **pendiente de verificación** — la app te lleva
   directo al **Panel de vendedor**, pestaña Inventario, donde ya puedes
   cargar tus productos reales aunque la aprobación todavía no haya
   pasado: uno por uno (con compatibilidad de vehículo obligatoria y hasta
   8 fotos reales), o de golpe con **Importar por Excel** (plantilla
   oficial descargable desde el mismo botón, pensada para cientos o miles
   de productos — las fotos se cargan aparte, producto por producto).
4. Una tienda pendiente **no aparece para compradores** hasta que se
   aprueba — quien tenga rol de administrador lo hace desde **Panel de
   administración** (`#/admin`, un enlace más en "Mi cuenta"), ver
   `server/README.md`, sección "Panel de administración".

Una cuenta sin marcar esa casilla queda como comprador normal (igual que
cualquier persona real usando la app).

## PWA — instalar RedAuto en el Home Screen (iPhone y otros)

RedAuto es instalable como **Progressive Web App**: agregable a la pantalla
de inicio, abre en modo standalone (sin la barra de Safari) con el ícono y
nombre "RedAuto", y se actualiza sola. Es puramente configuración añadida
— no cambió ninguna pantalla, componente, color ni navegación existente.

**Archivos nuevos (nada más se tocó para esto):**
- [`manifest.webmanifest`](manifest.webmanifest) — nombre, ícono, colores,
  `display: standalone`.
- [`sw.js`](sw.js) — service worker: cachea el shell estático (HTML/CSS/JS/
  íconos) para que abra al instante y funcione sin red; **nunca** cachea
  `/api/*` ni nada de otro origen, así que los datos reales del backend
  siempre llegan frescos.
- [`js/pwa.js`](js/pwa.js) — registra el service worker. Archivo aparte a
  propósito: es configuración de instalación/actualización, no lógica de
  producto (no importa nada de `services/` ni `screens/`, y nada los
  importa a él).
- `assets/icons/` — el ícono que subiste, exportado a los tamaños que pide
  iOS (`apple-touch-icon`, 120/152/167/180px) y el estándar de PWA
  (192/512px, más versión "maskable" con margen de seguridad para Android).
  El logo dentro de la app (splash, encabezado) sigue siendo el mismo de
  siempre — este ícono nuevo es solo para el Home Screen y la pestaña del
  navegador.
- `index.html` — sólo se agregaron las etiquetas `<link>`/`<meta>` que
  iOS/PWA necesitan (manifest, apple-touch-icon, `apple-mobile-web-app-*`)
  y la carga de `js/pwa.js`. La pantalla de carga (splash) y todo lo demás
  quedaron intactos.

**Cómo se actualiza sin reinstalar:** el service worker pide siempre la
versión de red primero ("network-first") — así que cualquier cambio que
publiques (una pantalla, un estilo, una corrección) se ve en tu iPhone
apenas abras la app de nuevo con conexión, sin tocar el ícono. Sólo si no
hay conexión cae a la última copia guardada en caché, para que la app siga
abriendo offline. Si alguna vez publicas un cambio en `sw.js` mismo (por
ejemplo, para cambiar la estrategia de caché), el navegador lo detecta
solo, activa la versión nueva y recarga la pestaña abierta una sola vez —
no hace falta desinstalar nada.

**Cómo probarlo ya mismo (en este entorno, sin instalar todavía):**
```bash
python3 -m http.server 8080   # o el server estático que prefieras
```
Abre `http://localhost:8080` — el manifest, los íconos y el service worker
ya están activos (revisa la pestaña *Application* de las herramientas de
desarrollador: *Manifest* y *Service Workers*).

**Cómo instalarlo de verdad en tu iPhone:** Safari sólo permite instalar
(y sólo activa el service worker de forma completa) sobre **HTTPS**, o
sobre `localhost` en el mismo dispositivo — un `http://` servido desde tu
computador en la red local no alcanza para que el iPhone lo instale como
PWA real. Necesitas desplegar el frontend en cualquier hosting estático con
HTTPS gratis (Netlify, Vercel, GitHub Pages, Cloudflare Pages) — el mismo
tipo de despliegue simple que ya se documenta para el backend en
`server/README.md`. Una vez desplegado:
1. Abre la URL en Safari en tu iPhone.
2. Toca el ícono de **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elige **"Añadir a la pantalla de inicio"**.
4. Confirma — verás el ícono con el nombre "RedAuto" en tu Home Screen.
5. Al tocarlo, abre en pantalla completa (sin la barra de direcciones de
   Safari), directo en la pantalla de carga de siempre.

## Arquitectura

```
index.html          Shell de la app (splash, header/nav/toast/modal son contenedores fijos)
manifest.webmanifest PWA: nombre, ícono, colores, display standalone
sw.js                Service worker: cachea el shell estático, nunca /api/ ni otro origen
assets/              logo-mark.png / favicon.png (logo dentro de la app, sin tocar)
  icons/              Íconos de Home Screen/PWA generados del logo provisto (apple-touch-icon, manifest)
css/styles.css       Sistema de diseño: tokens de color/tipografía/sombra + componentes
server/              Backend real (Node.js + Express + Postgres) — ver server/README.md
js/
  app.js             Punto de entrada: arranca el router y controla el splash screen
  pwa.js               Registro del service worker (config PWA, separado de la lógica de la app)
  config.js            URL del backend (window.REDAUTO_API_URL, ver index.html)
  router.js           Router hash-based, mapea rutas -> pantallas, transición de entrada
  nav.js               navigate()/parseHash(), sin dependencias circulares
  data/                Catálogo local fijo (categorías, vehículos, notificaciones/reseñas
                       de muestra) — ver services/*.js para qué ya es real
    categories.js, vehicles.js, notifications.js, reviews.js, venezuelaStates.js
  services/            Capa de negocio — el único punto de acceso a los datos
    storage.js          Envoltorio sobre localStorage (namespacing + try/catch)
    api.js                Cliente HTTP hacia el backend real (fetch + JWT + errores)
    productService.js   Búsqueda/filtros, compatibilidad, estado de inventario;
                         sólo productos reales del backend, sin catálogo de muestra
    storeService.js      Tiendas verificadas reales del backend, sin catálogo de muestra
    categoryService.js
    vehicleService.js    "Mis Vehículos": garage (CRUD) + vehículo activo (localStorage)
    cartService.js        Carrito (localStorage) + evento global de cambio
    favoritesService.js   Favoritos de productos y de tiendas (localStorage)
    authService.js         Cuenta y sesión reales contra el backend (JWT)
    orderService.js         Pedidos reales contra el backend (checkout, historial), sin pagos automatizados
    sellerService.js         Panel de vendedor: productos, tienda, compatibilidad, import Excel y fotos reales
    notificationService.js   Centro de notificaciones (leído/no leído, localStorage)
    adminService.js           Panel de administración: listar tiendas por estado, aprobar/rechazar
  ui/                   Presentación reutilizable
    icons.js, productArt.js (ilustraciones de producto), components.js,
    toast.js, modal.js, chat.js ("Preguntar a la tienda"),
    productImport.js (modal de importación masiva por Excel)
  screens/              Una pantalla = una función render(container, params)
    home.js, search.js, product.js, stores.js, storeDetail.js,
    cart.js, checkout.js, login.js, register.js, profile.js, seller.js,
    admin.js (panel de administración, sólo rol admin),
    myVehicles.js, favorites.js, notifications.js
```

**Por qué esta forma:** cada pantalla sólo habla con los `services/`, nunca
importa `data/` directamente (salvo catálogos de sólo lectura como
categorías/vehículos). Eso significa que reemplazar `productService.search()`
por un `fetch('/api/products/search')`, o `authService.login()` por una
llamada a un backend real, no debería tocar ninguna pantalla.

## Flujos funcionales implementados

1. **Splash screen** — minimalista, al estilo del arranque de una app nativa:
   fondo negro liso, glow rojo ambiental y el logo con un anillo de carga
   circular alrededor (sin texto ni barra abajo), ~2s antes de entrar a la
   app.
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
10. **Carrito y checkout** — agregar/quitar/actualizar cantidades, el
    carrito persiste en `localStorage` (borrador de compra, antes de
    confirmar); CTA del carrito es **"Continuar al pago"** y el de checkout
    es específico, **"Pagar $XX.XX"** (nunca un "Continuar" ambiguo).
    Checkout exige sesión iniciada, pide datos de entrega y crea un
    **pedido real** (`POST /api/orders`, precio y nombre resueltos y
    congelados del lado del servidor) en estado explícito **"pendiente de
    pago"** — no se simula ningún pago exitoso; una nota de "Protección de
    compra RedAuto" refuerza que el pedido y el historial quedan dentro de
    la plataforma, ahora persistidos de verdad.
11. **Cuenta** — login/registro **reales** contra el backend (contraseñas
    con hash, sesión con JWT), sin cuentas de demostración. Al registrarse,
    marcar "Quiero vender en RedAuto" crea además una tienda real asociada
    a la cuenta. Perfil con historial de pedidos y accesos a
    vehículos/favoritos/notificaciones.
12. **Panel de vendedor** — sólo accesible con una cuenta de rol `vendedor`:
    resumen de ventas reales, **pedidos reales de la tienda** (con botón
    para marcarlos "Pagado" o "Cancelar" — el vendedor confirma el cobro a
    mano, sin pasarela de pago todavía), inventario con alta/edición de
    productos (con compatibilidad de vehículo real, obligatoria) **e
    importación masiva por Excel**, todo **persistido en la base de datos
    real** (no en `localStorage`), edición de la info de la empresa, y
    estado de verificación real (pendiente/verificada/rechazada).

## Qué es real, qué es simulado, y qué está listo para conectarse

**Ya conectado a un backend real (`server/`, Postgres — sin datos de
muestra):**
- Cuenta de usuario y sesión (`authService`): contraseñas con hash
  (bcrypt), sesión con JWT. Sin cuentas de demostración.
- Registro de tienda completo (RIF, responsable, WhatsApp, dirección,
  estado, categorías) — parte del mismo flujo de registro, con la opción
  "Quiero vender en RedAuto". La tienda queda **pendiente de verificación
  real**, no se auto-publica.
- **Panel de administración** (`#/admin`, sólo visible/accesible con rol
  `admin` — nadie lo tiene por defecto, se asigna a mano): lista de tiendas
  por estado con aprobar/rechazar de un toque, en vez de SQL directo (ver
  `server/README.md`, "Panel de administración").
- Alta y edición de productos desde el panel de vendedor
  (`sellerService`/`productService`), **con compatibilidad de vehículos
  real y obligatoria** (marca/modelo/año/motor/versión, varios vehículos
  por producto) — un producto que agregas ahí queda en la base de datos,
  visible para cualquier comprador una vez tu tienda está verificada.
- **Importación masiva de productos por Excel** desde el panel de
  vendedor: plantilla oficial descargable, vista previa con validación por
  fila antes de tocar la base, e importación de cientos/miles de productos
  con sus compatibilidades. Re-subir el mismo SKU actualiza en vez de
  duplicar.
- **Fotos reales de producto**: hasta 8 fotos por producto, subidas a
  Cloudinary desde el panel de vendedor, con vista previa antes de guardar,
  y borrar/reordenar sobre un producto ya existente. Un producto sin fotos
  todavía sigue mostrando la ilustración por categoría generada en el
  cliente como respaldo.
- **Logo real de tienda**: se sube al registrarte (o después, desde
  "Editar información de mi tienda" en el panel de vendedor) — misma
  subida a Cloudinary que las fotos de producto. Se ve en las tarjetas de
  tienda, en la ficha de producto y en el detalle de la tienda; sin logo
  todavía, se siguen mostrando las iniciales sobre el degradado de marca.
- Navegación de compra (Inicio, Buscar, Tiendas, detalle de producto/
  tienda): muestra sólo tiendas/productos reales y **verificados** del
  backend — sin catálogo de muestra mezclado (ver `docs/DECISIONES.md`).
  Si no hay resultados reales todavía, la app lo dice honestamente ("sin
  resultados") en vez de mostrar un negocio que no existe. Lo que subas
  aparece en esta misma navegación sin ninguna pantalla nueva, apenas se
  apruebe tu tienda.
- **Pedidos reales**: al confirmar la compra en el checkout, se crea un
  pedido de verdad en la base de datos — precio y nombre de cada línea
  resueltos y congelados del lado del servidor (nunca del cliente), visible
  desde cualquier dispositivo tanto para el comprador ("Mis pedidos" en
  Perfil) como para cada tienda involucrada (pestaña Pedidos del panel de
  vendedor). Sin pasarela de pago conectada todavía: el pedido queda
  "pendiente de pago" y el vendedor lo marca "Pagado" a mano tras confirmar
  el cobro coordinado por fuera (WhatsApp/transferencia).

**Todavía simulado en el navegador (sin servidor) — ver
`docs/ROADMAP.md` para el orden en que se conecta cada uno:**
- Carrito (antes de confirmar la compra), favoritos (productos y tiendas) y
  garage de vehículos (`localStorage`) — el carrito se queda ahí a
  propósito: es un borrador de bajo riesgo, no un dato de negocio que se
  pierda si desaparece.
- Importación masiva de fotos (ZIP o URLs por columna en el Excel): la
  subida de fotos una por una ya es real, pero cargar muchas de golpe sigue
  siendo sólo diseño (`docs/BASE_DE_DATOS.md` §4.1), a propósito.
- Notificaciones y reseñas: datos de muestra fijos.
- Chat "Preguntar a la tienda": las respuestas se generan en el cliente a
  partir de los datos reales del producto/tienda (no hay mensajería real ni
  un vendedor humano respondiendo). WhatsApp/llamada quedan como respaldo
  secundario y usan `wa.me`/`tel:` reales.

**Cómo sigue conectándose el resto sin rediseñar pantallas:** cada
`services/*.js` expone funciones `async` con un contrato estable, así que
mover favoritos/garage al backend (si algún día hace falta) es el mismo
patrón ya usado para auth, productos y pedidos — reemplazar el cuerpo de la
función, no su firma (ver `docs/ARQUITECTURA.md` §12). El esquema
relacional completo (incluidas las
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

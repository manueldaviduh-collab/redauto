# Principios de RedAuto

Este documento es la referencia corta a la que volver cuando una decisión de
producto o de ingeniería no está clara. Si una funcionalidad nueva, un
cambio de diseño o una decisión técnica choca con algo de aquí, gana este
documento — y si de verdad hace falta romperlo, se actualiza el documento a
propósito, no se rompe en silencio.

## 1. RedAuto es un marketplace, no un directorio

La plataforma existe para que la compra se **complete dentro de RedAuto**,
no para poner en contacto al comprador con la tienda y desaparecer. Esto no
es una preferencia estética: es el modelo de negocio (comisión por
transacción — ver [`ROADMAP.md`](./ROADMAP.md)). Un marketplace que no
retiene la transacción no cobra comisión, y no tiene con qué operar.

Consecuencias concretas ya aplicadas en la app:
- El CTA principal en producto y tienda siempre es **Agregar al
  carrito** / **Comprar ahora** / **Ver catálogo**, nunca "Contactar por
  WhatsApp".
- Existe un chat propio ("Preguntar a la tienda", `js/ui/chat.js`) para
  resolver dudas de compra sin sacar al usuario de la app.
- WhatsApp y llamada siguen disponibles (no se le esconde al usuario cómo
  contactar a la tienda por fuera — eso sería un patrón engañoso), pero como
  fila secundaria y discreta, nunca como el botón más grande de la pantalla.

Antes de agregar cualquier funcionalidad nueva, la pregunta de filtro es:
**¿esto ayuda a encontrar, confiar, decidir y comprar dentro de RedAuto?**
Si la respuesta es no, no se agrega solo porque "se ve bien" o "lo tienen
otras apps".

## 2. Solo tiendas verificadas

RedAuto no es un clasificado abierto. Toda tienda visible pasó (o pasará,
cuando exista el flujo real) un proceso de verificación. El badge "Tienda
verificada RedAuto" es la señal de confianza principal de la plataforma —
por eso aparece en rojo (el color de marca), no como un detalle gris más.

No incluir talleres, mecánicos ni servicios de reparación. El foco es
100% venta de repuestos. Esto puede revisarse en una etapa futura como
línea de negocio separada, pero no mezclada dentro del mismo flujo de
compra (ver [`ROADMAP.md`](./ROADMAP.md), "Fuera de alcance por ahora").

## 3. Mobile-first, sensación de app real

El comprador objetivo abre esto desde el teléfono, en la calle o en el
taller, no desde un escritorio. Toda pantalla se diseña primero para
375–430px de ancho; el layout de escritorio (desde 1024px) es una
adaptación de eso, nunca al revés. Ver `css/styles.css` — los tokens de
diseño (`--bottom-nav-height`, `--sidebar-width`, etc.) existen
precisamente para que ese cambio de composición sea manejable.

Esto también es una decisión de UX, no solo técnica: nada de "página web
reducida a celular". Navegación inferior fija, áreas táctiles de 44px+,
estados de carga (skeletons) en vez de saltos bruscos de contenido,
microinteracciones (hover/tap) en vez de superficies muertas.

## 4. Transparencia — nunca simular éxito falso

Este es un MVP sin backend de pagos real. Eso se declara explícitamente en
la UI (`checkout.js` muestra "Pago en línea — próximamente" antes del
botón, y el pedido queda en estado **"Pendiente de pago (MVP)"**, nunca
"Pagado"). No se simula ningún flujo que el usuario pueda confundir con un
resultado real:
- No hay "✅ Pago exitoso" sin que haya pasado un pago real.
- No hay mensajería falsa entre el usuario y un humano en la tienda (el
  chat deja claro, en su propia respuesta, que las contestaciones vienen de
  los datos del catálogo, no de una persona escribiendo en vivo).
- No hay patrones oscuros para impedir que el usuario contacte a la tienda
  por fuera si quiere — solo se le da una razón mejor para no hacerlo.

Cuando una funcionalidad tenga una limitación real (sin pasarela de pago,
sin verificación KYC real, sin mensajería en vivo), esa limitación se
declara en la UI y se documenta en el README/`ARQUITECTURA.md`, no se
disimula.

## 5. Identidad de marca fija

Negro/grafito, rojo `#E53935`, blanco, tipografía Poppins. El logo es el
ícono provisto por el dueño del producto (`assets/logo-mark.png`), no una
reinterpretación. Un rediseño de marca es una decisión de negocio, no algo
que se cambia de pasada al implementar una funcionalidad.

## 6. Simple hoy, no obstaculizar mañana

El equipo hoy es muy chico (un fundador + asistencia de IA) probando con un
puñado de tiendas reales. Eso significa:
- **No construir para una escala que no existe todavía.** Nada de colas de
  mensajes, microservicios, sharding de base de datos, etc. mientras el
  volumen real quepa cómodo en un servidor y una base de datos relacional
  (ver [`ARQUITECTURA.md`](./ARQUITECTURA.md), "Cuándo NO escalar
  todavía").
- **Pero tampoco tomar atajos que sean caros de deshacer.** Ejemplos ya
  aplicados: precios en centavos enteros (no floats) desde el primer
  esquema de base de datos; `order_items` con snapshot del precio/nombre
  del producto (para que un pedido pasado no cambie si el producto se edita
  después); cada tabla del dominio de tienda lleva `store_id` desde el
  día uno, aunque hoy solo haya una tienda de prueba — así el salto a
  multi-tienda real no exige una migración de datos, exige encender lo que
  ya está ahí.

Esta tensión (no sobre-construir vs. no dejar deuda cara) es exactamente el
tipo de decisión donde este documento espera que el arquitecto —humano o
IA— avise explícitamente cuando algo la esté rompiendo, en vez de callarlo
por avanzar más rápido esta semana.

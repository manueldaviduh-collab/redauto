# Roadmap de RedAuto

Este roadmap no asume que va a haber millones de usuarios. Asume que hay
que probar, con la menor inversión posible, si tiendas reales y
compradores reales usan esto — y construir la base para que, si funciona,
crecer no obligue a reescribir todo. Cada etapa dice: el objetivo, qué hay
que construir, qué se deja explícitamente afuera, y la señal de que es
momento de pasar a la siguiente.

## Etapa 0 — Piloto cerrado con tiendas reales (las tiendas del papá)

**Objetivo:** validar tres cosas con el menor esfuerzo posible, antes de
construir nada más:
1. ¿Un comprador real encuentra el repuesto correcto y completa una compra
   (aunque el pago se coordine por fuera todavía)?
2. ¿El dueño de una tienda real encuentra el panel de vendedor usable para
   mantener su inventario al día?
3. ¿El chat/las fichas de producto resuelven dudas reales, o los
   compradores igual terminan escribiendo por WhatsApp?

**Requisito técnico antes de arrancar (no es opcional):** mover
`products`, `stores` y `orders` a un backend real compartido — ver
`BASE_DE_DATOS.md` §4, paso 1–2. Con `localStorage` como está hoy, el
catálogo que el papá del fundador edite en su teléfono **no lo va a ver
ningún comprador en el suyo**. Este es el bloqueador #1 documentado en
`ARQUITECTURA.md` §11, y hay que resolverlo antes de la Etapa 0, no
durante.

**Alcance de esta etapa:**
- Un puñado de tiendas reales (las del papá + quizás 1–2 más), cargadas a
  mano (por el fundador, no self-service todavía) en la base de datos.
- Compradores reales (familia, clientes existentes de esas tiendas,
  círculo cercano), no adquisición pública todavía.
- El pago se sigue coordinando por fuera de la app (transferencia, pago
  móvil, efectivo contra entrega) — el pedido queda en la app como
  registro (`payment_status: pendiente` → un admin lo marca `pagado` a
  mano tras confirmar el cobro). Esto no es hacer trampa con la
  transparencia (ver `PRINCIPIOS.md` §4): se sigue mostrando honestamente
  como "pendiente de confirmación", solo que ahora ese estado vive en un
  backend real en vez de en el navegador de cada quien.
- Verificación de tienda: manual, hecha por el fundador (no hace falta
  automatizar KYC para 2–5 tiendas de confianza).

**Explícitamente fuera de esta etapa:** self-service de alta de tiendas,
pasarela de pago real, búsqueda a gran escala, apps nativas, marketing
pago.

**Señal de pasar a la Etapa 1:** las tres preguntas de arriba tienen
respuesta — sobre todo la 1 y la 2. Si el dueño de la tienda no usa el
panel de vendedor sin ayuda, ese es el problema a resolver antes de sumar
más tiendas, no una pantalla nueva.

## Etapa 1 — Backend real mínimo + primeras tiendas fuera del círculo cercano

**Objetivo:** que el producto sostenga tiendas que el fundador no conoce
personalmente, sin que el fundador tenga que cargar cada catálogo a mano.

**Qué se construye:**
- API real (recomendado: empezar simple — Supabase u otra plataforma que
  dé Postgres + auth + storage ya integrados, para no reconstruir auth
  desde cero; alternativa igual de válida: backend propio en Node.js +
  Postgres si el equipo prefiere control total desde ya — ver
  `DECISIONES.md`, ADR-007).
- El panel de vendedor pasa a escribir contra ese backend (adiós
  `product_overrides` en `localStorage`).
- Sesión de usuario real (adiós `session`/`users_extra` en
  `localStorage`) — login persiste entre dispositivos.
- Historial de pedidos real, visible desde cualquier dispositivo.
- Tests de humo automatizados (Playwright) para el flujo crítico: login →
  buscar → agregar al carrito → checkout, y alta de producto en el panel
  de vendedor — ver `ARQUITECTURA.md` §15. A partir de aquí hay más de un
  cambio por semana tocando el mismo código; sin esto, algo se rompe sin
  que nadie lo note hasta que un usuario real se queja.
- Verificación de tienda sigue siendo manual, pero con un flujo dentro del
  panel (formulario + `store_verification_requests`), no por WhatsApp con
  el fundador.

**Explícitamente fuera de esta etapa:** pasarela de pago automatizada
todavía (pago sigue coordinándose y confirmándose a mano — ahora al menos
sobre datos centralizados); motor de búsqueda dedicado; multi-idioma.

**Señal de pasar a la Etapa 2:** hay más tiendas pidiendo entrar de las
que el fundador puede verificar/cargar a mano cómodamente, y/o el volumen
de pedidos hace que confirmar pagos uno por uno deje de ser sostenible.

## Etapa 2 — Alta de tiendas self-service + confianza real

**Objetivo:** que una tienda nueva pueda registrarse, pedir verificación y
empezar a vender sin que el fundador intervenga manualmente en cada paso.

**Qué se construye:**
- Registro de tienda self-service (formulario + subida de documentos →
  `store_verification_requests`), con un panel simple de administración
  para aprobar/rechazar (aunque quien apruebe siga siendo una persona, no
  un proceso automático — automatizar KYC de verdad es un problema aparte,
  no crítico todavía).
- Reseñas reales de compradores, ligadas a `order_id` (solo quien compró
  puede reseñar — ver `BASE_DE_DATOS.md` §3).
- Notificaciones reales (al menos email; push si aplica), reemplazando los
  datos de muestra de `notificationService`.
- Instrumentación básica de analítica/eventos (funnel: ver producto →
  agregar al carrito → checkout → pedido confirmado). No se construyó
  antes porque sin usuarios reales no había nada que medir — ahora sí lo
  hay, y es el insumo para decidir qué priorizar después con datos, no
  con intuición.
- Aquí es donde empieza a tener sentido evaluar mensajería real
  tienda-comprador (reemplazando la simulación de `js/ui/chat.js` — ver
  `DECISIONES.md`, ADR-006) **si** el volumen de preguntas que el chat
  simulado no resuelve es alto.

**Explícitamente fuera de esta etapa:** expansión fuera de Venezuela /
multi-moneda; comparación de precios entre tiendas; cupones y puntos de
recompensa (ver más abajo — se preparan conceptualmente, no se construyen
todavía).

**Señal de pasar a la Etapa 3:** el catálogo y el volumen de pedidos ya
estiran los límites documentados en `ARQUITECTURA.md` §11 (búsqueda con
miles de productos, necesidad real de pago automatizado por volumen).

## Etapa 3 — Escala: pagos reales, logística, crecimiento

**Objetivo:** dejar de depender de coordinar pagos y entregas a mano.

**Qué se construye (en el orden que el negocio lo vaya necesitando, no
todo junto):**
- **Pasarela de pago real.** Para Venezuela específicamente, esto exige
  evaluar opciones locales (procesadores de pago móvil/transferencia
  nacional) junto con opciones en USD (tarjeta internacional, o
  soluciones basadas en stablecoins, cada vez más comunes en la región
  para evitar fricción cambiaria) — es una decisión de negocio con
  implicaciones legales/fiscales reales, no solo técnica; amerita su
  propio documento de decisión cuando llegue el momento, no una elección
  apurada dentro de este roadmap.
- **Envíos/logística real** — integración con transportistas o cálculo de
  tarifa real, reemplazando "A calcular con la tienda".
- **Búsqueda a escala**, si el catálogo lo amerita (ver
  `ARQUITECTURA.md` §14: Postgres con índices alcanza hasta miles de
  productos; recién a partir de ahí se evalúa un motor dedicado).
- **Multi-ciudad / multi-país**, si el modelo ya probado en Venezuela se
  quiere replicar.
- **Incentivos para comprar dentro de RedAuto** (mencionados como
  preparación conceptual desde que se definió el principio de conversión
  — ver `PRINCIPIOS.md` §1): protección de compra formal, cupones,
  puntos/recompensas, recomendaciones de productos compatibles,
  comparación de precios entre tiendas para un mismo repuesto. Ninguno de
  estos se construye antes de tener volumen real de pedidos que los
  justifique — construirlos antes sería optimizar un funnel que todavía
  no existe.

## Fuera de alcance indefinidamente (a menos que cambie la estrategia)

- **Talleres, mecánicos o servicios de reparación** dentro del mismo flujo
  de compra de repuestos (ver `PRINCIPIOS.md` §2). Si algún día se agrega,
  es una línea de producto separada, no una pantalla más de este
  marketplace.
- Cualquier funcionalidad que no pase el filtro de `PRINCIPIOS.md` §1:
  *¿esto ayuda a encontrar, confiar, decidir y comprar dentro de
  RedAuto?*

## Modelo de negocio (contexto para todas las decisiones de arriba)

La fuente de ingresos principal asumida es **comisión por transacción**
completada dentro de la plataforma. Membresías, publicidad y otros
servicios son ingresos secundarios, no el sostén del producto. Esto es la
razón de fondo de todo el principio de conversión (`PRINCIPIOS.md` §1): si
la transacción se completa por fuera, RedAuto no cobra nada por
haberla originado.

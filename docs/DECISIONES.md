# Decisiones de arquitectura

Registro corto de las decisiones que no son obvias con solo leer el código:
qué se decidió, qué otras opciones se consideraron, qué se acepta a cambio,
y en qué momento conviene revisar la decisión. El formato es liviano a
propósito — un archivo, entradas cortas — porque el equipo hoy es chico.
Si el equipo crece y este archivo se vuelve difícil de navegar, el próximo
paso natural es partirlo en `docs/decisiones/0001-titulo.md`,
`0002-titulo.md`, etc. (un ADR por archivo); no hace falta hacerlo antes.

---

## ADR-001 — Sin framework de frontend (JS vanilla + módulos ES)

**Contexto:** Había que elegir entre React/Vue/Svelte con build step, o
HTML/CSS/JS servido directo, sin compilar.

**Decisión:** JS vanilla con módulos ES nativos del navegador. Sin
bundler, sin build step — `index.html` se abre con cualquier servidor
estático y funciona.

**Alternativas consideradas:**
- *React/Vue con Vite.* Da manejo de estado reactivo, ecosistema de
  componentes, y facilita tests. Costo: build step, `node_modules`, una
  curva de configuración que no se justifica para 14 pantallas mayormente
  de lectura + formularios simples.
- *Web Components.* Encapsulación real sin framework, pero la ergonomía
  para listas grandes (resultados de búsqueda, catálogo) es peor que
  template strings + `innerHTML`.

**Consecuencias:**
- Cero dependencias de build, cualquiera clona el repo y lo corre con
  `python3 -m http.server`.
- El re-render es manual (`container.innerHTML = ...` + re-bind de
  eventos) — sin diffing, así que hay que ser disciplinado con el
  `screen.render()` re-escribiendo todo el contenedor en vez de mutar
  nodos sueltos (ver `ARQUITECTURA.md` §4).
- Sin este framework, tampoco hay su ecosistema de testing (Testing
  Library, etc.) gratis — la deuda de tests automatizados (ver
  `ARQUITECTURA.md` §9) hay que pagarla con herramientas más manuales
  (Playwright directo).

**Cuándo reconsiderar:** si el número de pantallas con estado interno
complejo (formularios con validación cruzada, listas que se reordenan en
vivo, etc.) crece mucho más allá de lo actual, o si el equipo de
desarrollo crece a un tamaño donde la convención implícita ("así se
escribe un `render()`") deja de ser suficiente y hace falta que el
framework la imponga.

---

## ADR-002 — Arquitectura en capas (`data` → `services` → `screens`)

**Contexto:** Sin backend, era tentador que cada pantalla leyera
`data/products.js` directo y ya.

**Decisión:** Ninguna pantalla toca `data/*.js` para nada que tenga
estado (todo pasa por `services/*.js`). Ver `ARQUITECTURA.md` §2.

**Alternativas consideradas:**
- *Pantallas leyendo `data/` directo.* Menos código hoy, pero significa
  reescribir las 14 pantallas el día que llegue el backend, en vez de
  reemplazar 10 archivos de `services/`.

**Consecuencias:** una capa más de indirección para features simples
(un extra `import` y una función intermedia), a cambio de que la migración
a backend sea localizada (ver `ARQUITECTURA.md` §7).

**Cuándo reconsiderar:** nunca, mientras el proyecto tenga más de una
pantalla — es la decisión que más protege el trabajo futuro y su costo es
casi nulo.

---

## ADR-003 — `localStorage` como "backend" temporal

**Contexto:** Necesitábamos persistencia (carrito, sesión, favoritos,
inventario editado por el vendedor) sin levantar un servidor todavía.

**Decisión:** todo por `localStorage`, namespaced (`redauto_*`), a través
de un único wrapper (`js/services/storage.js`) — nunca `localStorage`
llamado directo desde otro archivo.

**Alternativas consideradas:**
- *IndexedDB.* Más capacidad y consultas más ricas, pero API más compleja
  para un volumen de datos (unas decenas de KB) donde no hace falta.
- *Backend mínimo desde el día 1 (ej. Supabase).* Se descartó *solo para
  esta primera fase de diseño de UI/UX* — el objetivo era iterar rápido el
  producto sin esperar infraestructura. Esto **no** significa que sea
  aceptable lanzar el piloto real así (ver el bloqueador #1 en
  `ARQUITECTURA.md` §6 y la Etapa 0/1 de `ROADMAP.md`).

**Consecuencias:** cero infraestructura para desarrollar y demostrar la
UI. El costo real: los datos son por navegador, no por cuenta — un
vendedor que edita su catálogo en su teléfono no lo ve un comprador en el
suyo. Esto es aceptable para maquetar y para un demo, **no es aceptable
para el piloto con tiendas reales**.

**Cuándo reconsiderar:** ya — es la primera pieza que hay que reemplazar
antes de poner esto frente a una tienda real que no sea de prueba interna.
Ver `ROADMAP.md`, Etapa 1.

---

## ADR-004 — Enrutamiento por hash (`#/ruta`), sin servidor

**Contexto:** Sin backend no hay a quién pedirle que resuelva rutas del
lado del servidor (`/producto/123` como URL real requeriría un servidor
que sepa devolver `index.html` para cualquier ruta).

**Decisión:** rutas tipo `#/producto/123`, resueltas 100% en el cliente
(`js/router.js`).

**Alternativas consideradas:**
- *History API (`/producto/123` real, sin `#`).* Más limpio, pero exige
  que el servidor (o CDN) esté configurado para servir `index.html` en
  cualquier ruta — no trivial en un `python3 -m http.server` de
  desarrollo, y es una pieza de config que hay que llevarse al desplegar.

**Consecuencias:** cero configuración de servidor; el costo es URLs con
`#` (menos "profesionales" a primera vista, aunque funcionalmente
idénticas) y que **cualquier** cambio de `location.hash` — incluido un
simple ancla `href="#seccion"` para hacer scroll dentro de la misma
página — dispara el router. Esto causó un bug real (un botón "Ver
catálogo" con `href="#store-catalog"` terminaba mandando a Inicio en vez
de hacer scroll) — ya corregido usando `scrollIntoView()` en vez de
anclas de hash para scroll interno. Cualquier nuevo link "ancla" dentro
de una pantalla debe usar el mismo patrón, no un `href="#algo"` plano.

**Cuándo reconsiderar:** al mover el proyecto a un servidor/CDN real con
control de configuración de rutas (Etapa 1 del roadmap) — ahí sí conviene
pasar a History API por SEO y URLs limpias, ver el límite de SEO en
`ARQUITECTURA.md` §6.

---

## ADR-005 — Ilustraciones vectoriales de producto en vez de fotos

**Contexto:** Se pidió una experiencia visual "estilo Amazon" (fondo
blanco, producto centrado, alta calidad, sin marcas de agua).

**Decisión:** ilustraciones SVG propias por categoría
(`js/ui/productArt.js`), no fotografía.

**Alternativas consideradas:**
- *Fotografía de stock real.* Descartado: no hay banco de imágenes con
  licencia disponible en este proyecto, y usar fotos reales de marcas
  (Brembo, Bosch, etc.) sin derechos es un riesgo legal real, no
  hipotético.
- *Generador de imágenes IA.* No disponible en este entorno de trabajo.

**Consecuencias:** cero costo de licencias/derechos, tamaño de página
mínimo (SVG inline, no assets pesados), pero **no son fotos reales del
producto que la tienda vende** — un comprador exigente puede notar la
diferencia. Esto es una limitación de producto declarada, no escondida
(ver `README.md`).

**Cuándo reconsiderar:** en cuanto el piloto tenga tiendas reales
subiendo sus propios productos — ahí `product_images` (ver
`BASE_DE_DATOS.md`) pasa a alimentarse de fotos reales que cada tienda
sube desde su panel de vendedor, y las ilustraciones quedan como
*fallback* para productos sin foto todavía, no como el tratamiento
default.

---

## ADR-006 — WhatsApp como canal secundario, chat propio como primario

**Contexto:** Un marketplace de repuestos en Latinoamérica compite con el
hábito de "conseguir el WhatsApp de la tienda y comprar por fuera",
lo cual mata la comisión por transacción (ver `PRINCIPIOS.md` §1 y
`ROADMAP.md`, modelo de negocio).

**Decisión:** el chat "Preguntar a la tienda" (`js/ui/chat.js`), con
respuestas generadas desde los datos reales del producto/tienda
(compatibilidad, stock, tipo, entrega), es el CTA destacado para resolver
dudas. WhatsApp/llamada existen como fila secundaria, nunca escondidos.

**Alternativas consideradas:**
- *Mensajería real en vivo (tienda ↔ comprador) desde ya.* Requiere
  backend + tiempo real (websockets o polling) + que la tienda tenga a
  alguien respondiendo — no viable sin backend ni sin un flujo real de
  vendedor activo. Se dejó como un paso de la Etapa 2 del roadmap.
- *Quitar WhatsApp por completo.* Descartado explícitamente — sería un
  patrón engañoso (ver `PRINCIPIOS.md` §4), y además genuinamente le quita
  una opción real al comprador que la prefiera.

**Consecuencias:** el chat de hoy es una simulación inteligente (usa datos
reales, no inventa respuestas), no conversación real con un humano — se
declara así en `README.md`. Cuando exista backend + paneles de vendedor
activos, es el reemplazo natural de esta simulación por mensajería real.

**Cuándo reconsiderar:** cuando el volumen de preguntas que el chat
simulado *no* puede responder (por ser demasiado específicas) sea alto —
ahí es la señal de que hace falta escalar a mensajería real con la
tienda, no antes.

---

## ADR-007 — Base de datos relacional (Postgres) como objetivo, no NoSQL

**Contexto:** `BASE_DE_DATOS.md` define un esquema objetivo para cuando
exista backend. Había que elegir la familia de base de datos a apuntar.

**Decisión:** relacional (Postgres), con claves foráneas reales
(`store_id`, `product_id`, etc.) desde el día uno del esquema, aunque hoy
esos datos vivan en arrays de JS sin ninguna base de datos detrás.

**Alternativas consideradas:**
- *Documento/NoSQL (Firestore, MongoDB).* Más rápido para arrancar sin
  definir esquema, y con buen soporte de SDKs para frontend directo. Se
  descartó porque el dominio de RedAuto es **relacional por naturaleza**:
  pedidos con líneas de distintas tiendas, compatibilidad
  marca/modelo/año con rangos, reseñas ligadas a compras verificadas —
  todo esto son joins y agregaciones que una base relacional resuelve con
  una consulta indexada, y que en un modelo de documentos se resuelven a
  mano en el cliente o duplicando datos entre documentos (con el riesgo de
  que se desincronicen).
- *Backend-as-a-Service tipo Firebase/Supabase.* No es excluyente con
  "Postgres" — Supabase, de hecho, **es** Postgres con auth/storage/API
  encima. Se recomienda como la opción más rápida para la Etapa 1 del
  roadmap precisamente porque no obliga a elegir entre "relacional" y
  "rápido de levantar".

**Consecuencias:** el esquema exige definir tablas y relaciones por
adelantado (más trabajo de diseño ahora, ya hecho en
`BASE_DE_DATOS.md`), a cambio de consultas de compatibilidad de vehículo,
reportes de ventas por tienda y reseñas verificadas que son baratas y
correctas por construcción, no por disciplina manual en el código de la
aplicación.

**Cuándo reconsiderar:** si en algún punto aparece una necesidad de datos
genuinamente no relacional a gran escala (ej. un feed de actividad de muy
alto volumen) — ahí puede convenir una base secundaria especializada al
lado de Postgres, no en su lugar.

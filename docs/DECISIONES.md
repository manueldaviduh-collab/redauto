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
  nodos sueltos (ver `ARQUITECTURA.md` §5).
- Sin este framework, tampoco hay su ecosistema de testing (Testing
  Library, etc.) gratis — la deuda de tests automatizados (ver
  `ARQUITECTURA.md` §15) hay que pagarla con herramientas más manuales
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
estado (todo pasa por `services/*.js`). Ver `ARQUITECTURA.md` §3.

**Alternativas consideradas:**
- *Pantallas leyendo `data/` directo.* Menos código hoy, pero significa
  reescribir las 14 pantallas el día que llegue el backend, en vez de
  reemplazar 10 archivos de `services/`.

**Consecuencias:** una capa más de indirección para features simples
(un extra `import` y una función intermedia), a cambio de que la migración
a backend sea localizada (ver `ARQUITECTURA.md` §12).

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
  `ARQUITECTURA.md` §11 y la Etapa 0/1 de `ROADMAP.md`).

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
`ARQUITECTURA.md` §11.

---

## ADR-005 — Ilustraciones vectoriales de producto en vez de fotos

> **Superada por ADR-010.** Las ilustraciones SVG de `productArt.js` se
> retiraron a favor de renders 3D fotorrealistas en WebP — se deja este
> ADR como historial de por qué existieron en primer lugar.

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

---

## ADR-008 — Se quita el catálogo de muestra de la navegación de compra

**Contexto:** desde que existió `productService`/`storeService`, Home,
Buscar y Tiendas mezclaban las tiendas/productos reales del backend con un
catálogo de muestra fijo (`js/data/products.js`/`stores.js`, con ids
`p1`..`p24`/`st1`..`st5`) — decisión original documentada en ADR anterior
de `ARQUITECTURA.md` §10/§12, para que esas pantallas nunca se vieran
vacías mientras RedAuto no tenía ninguna tienda real registrada. Al llegar
las primeras tiendas reales, un comprador (y potencialmente el primer
negocio real a subir, el del padre del fundador) seguía viendo esas
tiendas ficticias mezcladas con las reales en la misma navegación, sin
ninguna marca visual que las distinguiera.

**Decisión:** eliminar por completo `js/data/products.js`, `stores.js` y
`users.js` (este último ya sin ningún uso real) y toda la lógica de mezcla
en `productService.js`/`storeService.js`. La navegación de compra ahora
muestra **sólo** datos reales y verificados del backend; si el backend no
responde o no hay resultados, se muestra el estado vacío honesto que cada
pantalla ya tenía implementado (`emptyState()` en `search.js`,
`stores.js`, `storeDetail.js`), no un negocio inventado.

**Alternativas consideradas:**
- *Dejarlo como estaba, sólo como respaldo de emergencia si el backend
  cae.* Se descartó: la app ya depende del backend real para todo lo que
  importa (login, checkout, panel de vendedor) — un catálogo de muestra
  como "red de seguridad" sólo para dos pantallas de lectura no vale el
  riesgo de mostrarle a un comprador real una tienda que no puede
  contactar ni comprarle.
- *Marcar visualmente las tiendas de muestra ("demo") en vez de
  quitarlas.* Añade complejidad de UI (badges, filtros) para un catálogo
  cuyo único propósito ya se cumplió (evitar pantallas vacías durante el
  desarrollo/piloto inicial).

**Consecuencias:**
- Home/Buscar/Tiendas pueden mostrar honestamente "sin resultados" si
  todavía no hay suficientes tiendas/productos reales en una ciudad o
  categoría — coherente con `docs/PRINCIPIOS.md` §4 (Transparencia), a
  costa de una navegación que puede sentirse más vacía al principio del
  piloto.
- `sw.js` deja de precachear los tres archivos eliminados (si no, el
  `cache.addAll()` del install del service worker falla por completo al
  referenciar un archivo que ya no existe).
- Menos superficie de código: `productService.js`/`storeService.js`
  pierden toda la lógica de "mezclar y no chocar namespaces de id".

**Cuándo reconsiderar:** si en el futuro se necesita de nuevo contenido de
demostración (por ejemplo, un modo "vista previa" para un vendedor nuevo
antes de que su tienda esté verificada), debería vivir claramente marcado
como tal en su propia pantalla — nunca mezclado sin distinción en la
navegación real de compra.

---

## ADR-009 — Importación masiva: arquitectura de adaptadores por fuente

**Contexto:** hasta ahora, `server/src/services/productImportParser.js`
sólo sabía leer un `.xlsx` con las columnas exactas de la plantilla
oficial de RedAuto — cualquier otro formato fallaba con "faltan columnas
obligatorias". El objetivo es que una tienda pueda subir el archivo que ya
exporta de su propio sistema (A2, Saint, Valery u otro) sin tener que
pasarlo antes por la plantilla de RedAuto a mano. Se decidió avanzar de
forma gradual: por ahora sólo cargas manuales de archivo (nada de
sincronización automática ni integraciones directas con esos sistemas).

**Decisión:** partir el parser en tres capas, cada una con una sola
responsabilidad:
1. **Lectura del archivo** (`import/readTabularFile.js`) — convierte
   `.xlsx` o `.csv` a una misma hoja de trabajo, sin saber nada de
   columnas de negocio.
2. **Adaptador por fuente** (`import/adapters/*.js`) — traduce esa hoja al
   vocabulario interno común (`sku`, `nombre`, `categoria`, `precio`, …).
   Cada fuente nueva (A2, Saint, Valery, otra) es un adaptador nuevo en
   este directorio; ninguna otra pieza del sistema cambia para eso.
3. **Validación y agrupado** (`import/validateAndGroup.js`) — reglas de
   negocio (categoría real, precio válido, agrupar por SKU, compatibilidad
   de vehículos), **exactamente las mismas de siempre**, sin importar de
   qué fuente vino la fila.

La fuente del archivo se detecta sola: cada adaptador expone
`matches(hoja)`, y se prueba cada uno registrado (`import/adapters/index.js`)
hasta encontrar el que reconoce el archivo — el vendedor nunca tiene que
elegir ni indicar de dónde viene su archivo. Si ninguno lo reconoce, se
avisa con un mensaje honesto en vez de adivinar y mapear mal (ver
`PRINCIPIOS.md`, Transparencia).

Hoy sólo existe un adaptador real: `redautoAdapter.js`, que reproduce
exactamente el comportamiento de siempre (mismas columnas, mismos
mensajes de error). Verificado con una comparación byte a byte contra el
parser anterior antes de reemplazarlo.

**Alternativas consideradas:**
- *Selector de fuente en la UI* (el vendedor elige "A2"/"Saint"/etc. antes
  de subir). Se descartó para esta fase: con un solo adaptador real no
  aporta nada, y la detección automática es más simple para el vendedor
  cuando haya más de una fuente.
- *Un único parser con `if/else` por fuente.* Es lo que había implícito
  antes de esta ADR (sólo RedAuto). Escala mal: cada fuente nueva
  arriesgaría tocar la validación compartida y duplicar reglas de negocio
  con pequeñas diferencias entre sí — justo el tipo de bug silencioso que
  este proyecto evita a propósito en otras áreas.

**Consecuencias:**
- Agregar A2/Saint/Valery cuando haya un archivo de ejemplo real es: un
  archivo nuevo en `import/adapters/` + una línea en el registro. Cero
  cambios en rutas, en el flujo preview→commit, ni en el frontend.
- El frontend (`js/ui/productImport.js`) no cambió — ya aceptaba `.xlsx`
  y `.csv` en el input de archivo (una promesa que antes no se cumplía
  del lado del backend; ahora sí).
- Deliberadamente **no** se tocó el esquema de base de datos ni se agregó
  ningún campo de "fuente"/"sincronizado desde" a `products` — no hace
  falta mientras la importación siga siendo manual y puntual. El día que
  esto se vuelva una sincronización recurrente (precios/stock que cambian
  seguido), hará falta revisar esto para no pisar ediciones manuales del
  vendedor — explícitamente fuera de alcance de esta ADR.

**Cuándo reconsiderar:** al construir el primer adaptador real (A2, Saint
o Valery) con un archivo de ejemplo de verdad — puede revelar necesidades
que hoy no se pueden anticipar sin adivinar (mapeo de categorías externas,
precio de costo vs. venta, formato real de la compatibilidad de
vehículos). También si la importación deja de ser "el vendedor sube un
archivo cuando quiere" y pasa a ser una sincronización recurrente.

---

## ADR-010 — Renders WebP de categoría en vez de ilustración SVG

**Contexto:** ADR-005 dejó la ilustración SVG explícitamente como algo a
reconsiderar cuando el listón visual subiera. Con la Guía Visual Oficial de
RedAuto v1 (dirección de arte "Apple + Amazon": renders 3D fotorrealistas,
fondo transparente, cámara y luz fijas por categoría), la ilustración plana
ya no alcanza — pero los renders definitivos todavía no existen (se
producen aparte, fuera de este repositorio). Esta ADR es sólo la
infraestructura para recibirlos, no los assets en sí.

**Decisión:** `js/ui/productArt.js` se elimina; `js/ui/categoryArt.js` lo
reemplaza con un `<img>` de `srcset` (256w/512w) apuntando a
`assets/category-art/<id>-<ancho>.webp`. Si el archivo de una categoría no
existe o falla al cargar, un único listener de documento (fase de captura,
ver el módulo — el evento `error` de `<img>` no burbujea) lo reemplaza en
el momento por el ícono de línea de esa categoría, el mismo que ya usa la
grilla de categorías de Inicio. `assets/category-art/` se creó vacía, con
sólo un `README.md` documentando los 16 nombres de archivo exactos que
espera y la especificación de producción — deliberadamente sin imágenes de
prueba ni placeholders.

**Alternativas consideradas:**
- *Generar placeholders o imágenes de prueba ahora.* Se pidió explícitamente
  no hacerlo — un placeholder walk-back después es más trabajo que dejar el
  fallback a ícono, que ya es honesto sobre "no hay render todavía" en vez
  de mostrar un relleno gris genérico.
- *Mantener las ilustraciones SVG como fallback intermedio* (en vez de caer
  directo al ícono) mientras se producen los renders. Se descartó: mantener
  dos sistemas de arte en paralelo (SVG detallado + WebP) sólo para una
  transición temporal no vale el costo — el ícono de línea ya existe, no
  cuesta nada mantenerlo, y es exactamente lo que ADR-005 preveía como
  destino del fallback.
- *`cache.addAll()` único incluyendo los WebP de categoría.* Descartado:
  `cache.addAll()` es atómico — un solo archivo faltante (los 16 no existen
  todavía) tumba la instalación completa del service worker, rompiendo el
  offline de toda la app por un asset que ni siquiera se está usando aún.

**Consecuencias:**
- Cero cambio de comportamiento visible hoy: sin renders reales, todas las
  categorías muestran su ícono de línea — el mismo resultado que mostraría
  cualquier categoría nueva sin ilustración bajo el sistema anterior.
- Agregar un render definitivo es soltar el archivo con el nombre correcto
  en `assets/category-art/` y subir `CACHE_VERSION` en `sw.js` — cero
  cambios de código.
- El service worker intenta precachear los 16 WebP en cada instalación y
  falla en silencio mientras no existan (ver `sw.js`, `CATEGORY_ART_URLS`);
  esto es ruido esperado, no un error a investigar.
- `sw.js` mantiene su propia lista de ids de categoría en paralelo a
  `js/data/categories.js` porque es un script clásico, no un módulo, y no
  puede importar el archivo real — el mismo compromiso que ya existe con
  cada ruta de `PRECACHE_URLS`.

**Cuándo reconsiderar:** si el número de categorías empieza a cambiar con
frecuencia, vale la pena evaluar servir `CATEGORY_ART_URLS` desde un JSON
generado en build en vez de una lista a mano en `sw.js`. Y, por supuesto,
en cuanto lleguen los primeros renders reales — ahí toca subir los
archivos y verificar visualmente contra el checklist de consistencia de la
Guía Visual antes de darlos por buenos en producción.

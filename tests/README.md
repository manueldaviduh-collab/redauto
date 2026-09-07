# Tests end-to-end de RedAuto

Suite de humo con [Playwright](https://playwright.dev) del camino crítico
del producto (ver `docs/ROADMAP.md`, Etapa 1, y `docs/ARQUITECTURA.md`
§15). Corre contra la app real — el mismo `index.html`/`js/`/`css/` sin
build step, y el backend real (`server/`) contra Postgres — nunca contra
mocks ni datos de muestra.

## Qué cubre

- **`e2e/comprador.spec.js`** — registro de comprador → buscar un producto
  → agregarlo al carrito → completar el checkout, verificando que el
  pedido quede registrado.
- **`e2e/vendedor.spec.js`** — registro de una tienda nueva (queda
  `pendiente` de verificación, como en producción) → alta de un producto
  desde el panel de vendedor.
- **`e2e/resenas.spec.js`** — un comprador con un pedido ya pagado escribe
  una reseña real desde la ficha del producto, verificando que aparece,
  que el resumen (estrella grande + conteo) se actualiza, que persiste
  tras recargar, y que el formulario ya no vuelve a aparecer para ese
  mismo pedido.

Cada corrida crea sus propios usuarios/tienda/producto con un sufijo
aleatorio — no depende de ni modifica datos existentes, así que es segura
de repetir sin resetear la base de datos entre corridas.

## Cómo correrla

Requisitos: PostgreSQL instalado (el `global-setup` intenta arrancarlo y
crear el rol/base `redauto` si hace falta — pensado para Linux/Debian con
`service postgresql`; en CI o en otro SO, provee Postgres ya accesible por
`DATABASE_URL` y este paso simplemente no hace falta).

```bash
cd tests
npm install
npm test
```

`playwright.config.js` levanta y apaga solo el backend (`server/`, puerto
4000) y un frontend estático (puerto 8080) — no hace falta arrancarlos a
mano. Para ver el navegador mientras corre: `npm run test:headed`. Para
ver el reporte HTML de la última corrida: `npm run report`.

## Decisiones que vale la pena explicar

**Por qué el frontend no se sirve con `python3 -m http.server` directo.**
`index.html` trae fija la URL del backend de producción
(`window.REDAUTO_API_URL`) — es la única línea que hay que tocar al
desplegar (ver `README.md` de la raíz). Para los tests hace falta que
apunte a `http://localhost:4000/api` en cambio, sin tocar el archivo en
disco. La primera versión de esto interceptaba la respuesta con
`page.route()` del lado del navegador — y eso colgaba indefinidamente el
fetch real hacia el backend (falla conocida de combinar interceptación de
red con un fetch cross-origin real, ya la habíamos visto antes en este
proyecto). La solución fue no interceptar nada en el navegador:
`fixtures/static-server.mjs` es un servidor Node mínimo que sirve el repo
tal cual, y sólo reescribe esa línea de `index.html` del lado del
servidor, antes de que el HTML llegue al navegador.

**Por qué `comprador.spec.js` verifica una tienda por SQL directo.**
`GET /api/products` sólo devuelve productos de tiendas con
`verification_status = 'verificada'`, y esa aprobación normalmente la hace
un admin a mano desde `#/admin` (ver `server/README.md`). Ese flujo de
aprobación no es lo que este spec verifica — lo que necesita es un
producto público real para que el comprador lo encuentre. `fixtures/sellerFixture.js`
registra la tienda por la API real (mismo camino que un vendedor de
verdad) y sólo fuerza por SQL el único paso que de otra forma exigiría
automatizar el panel de administración para un dato de setup. Si algún día
se agrega un test específico del flujo de aprobación, ese sí debería
manejarlo por UI, no por SQL.

**Por qué `resenas.spec.js` marca el pedido como `pagado` por SQL directo.**
Sólo se puede reseñar un producto que ya se compró y pagó (ver
`docs/BASE_DE_DATOS.md` §5) — el servidor lo valida contra `orders`/
`order_items` en cada intento, nunca confía en el cliente. Marcar un
pedido como pagado normalmente lo hace el vendedor desde su panel al
confirmar el cobro, y ese flujo no es lo que este spec verifica: lo que
necesita es una compra ya pagada de la que partir. `fixtures/paidOrderFixture.js`
crea el pedido por la API real (`POST /api/orders`, mismo camino que usa
`checkout.js`) y sólo fuerza por SQL el estado, mismo criterio que
`sellerFixture.js` con la verificación de tienda.

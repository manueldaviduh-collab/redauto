// Fixture de datos para resenas.spec.js: un comprador real con un pedido
// real (vía POST /api/orders, mismo camino que usa checkout.js) de un
// producto de una tienda ya verificada. El único bypass deliberado es
// marcar el pedido como 'pagado' — eso normalmente lo hace el vendedor
// desde su panel al confirmar el cobro (ver server/README.md), y ese flujo
// no es lo que resenas.spec.js verifica: lo que necesita es una compra ya
// pagada para poder reseñar. Mismo criterio que sellerFixture.js con la
// verificación de tienda — ver tests/README.md.
import { execSync } from 'node:child_process';
import { API_BASE_URL, DATABASE_URL } from './env.js';
import { createVerifiedProductFixture } from './sellerFixture.js';

export async function createPaidOrderFixture({ categoryId = 'motor' } = {}) {
  const { product } = await createVerifiedProductFixture({ categoryId });

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const buyerEmail = `fixture-buyer-${suffix}@example.com`;
  const buyerPassword = 'password123';

  const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Comprador Fixture',
      email: buyerEmail,
      password: buyerPassword,
      phone: '04141234567',
      city: 'Caracas',
    }),
  });
  if (!registerRes.ok) {
    throw new Error(`No se pudo registrar el comprador fixture: ${await registerRes.text()}`);
  }
  const { token } = await registerRes.json();

  const orderRes = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items: [{ productId: product.id, qty: 1 }],
      shipping: { name: 'Comprador Fixture', phone: '04141234567', address: 'Av. Fixture', city: 'Caracas' },
    }),
  });
  if (!orderRes.ok) {
    throw new Error(`No se pudo crear el pedido fixture: ${await orderRes.text()}`);
  }
  const { order } = await orderRes.json();

  execSync(
    `psql "${DATABASE_URL}" -c "UPDATE orders SET status='pagado' WHERE id='${order.id}';"`,
    { stdio: 'pipe', shell: '/bin/bash' }
  );

  return { buyerEmail, buyerPassword, product, orderId: order.id };
}

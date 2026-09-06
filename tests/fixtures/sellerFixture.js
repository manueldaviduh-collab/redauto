// Fixture de datos para comprador.spec.js: crea, vía la API real (no SQL a
// mano para lo que sí tiene endpoint), una tienda con un producto público.
// El único bypass deliberado es la verificación de la tienda — normalmente
// la aprueba un admin desde #/admin (ver server/README.md), pero ese no es
// el flujo que este spec verifica, así que se fuerza por SQL directo.
// Ver tests/README.md para el razonamiento completo.
import { execSync } from 'node:child_process';
import { API_BASE_URL, DATABASE_URL } from './env.js';

export async function createVerifiedProductFixture({ categoryId = 'motor' } = {}) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `fixture-seller-${suffix}@example.com`;
  const productName = `Producto Fixture ${suffix}`;

  const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vendedor Fixture',
      email,
      password: 'password123',
      phone: '04121234567',
      city: 'Caracas',
      storeName: `Tienda Fixture ${suffix}`,
      rif: 'J-88888888-0',
      responsibleName: 'Responsable Fixture',
      whatsapp: '04121234567',
      address: 'Av. Fixture, Local 1',
      state: 'Miranda',
    }),
  });
  if (!registerRes.ok) {
    throw new Error(`No se pudo registrar la tienda fixture: ${await registerRes.text()}`);
  }
  const { token, store } = await registerRes.json();

  execSync(
    `psql "${DATABASE_URL}" -c "UPDATE stores SET verification_status='verificada' WHERE id='${store.id}';"`,
    { stdio: 'pipe', shell: '/bin/bash' }
  );

  const price = 25.5;
  const productRes = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: productName,
      categoryId,
      type: 'alternativo',
      price,
      stock: 10,
      availability: 'en_stock',
      compatibility: [{ brand: 'Toyota', model: 'Corolla' }],
    }),
  });
  if (!productRes.ok) {
    throw new Error(`No se pudo crear el producto fixture: ${await productRes.text()}`);
  }
  const product = await productRes.json();

  return { productName, price, product, storeId: store.id };
}

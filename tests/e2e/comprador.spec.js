import { test, expect } from '@playwright/test';
import { gotoApp } from '../fixtures/appRoute.js';
import { createVerifiedProductFixture } from '../fixtures/sellerFixture.js';

// Camino crítico del comprador (ver docs/ROADMAP.md, Etapa 1): registro →
// buscar → agregar al carrito → checkout, contra el backend real. El
// producto que se busca lo crea el fixture (tienda ya verificada) — el
// resto de la interacción es 100% a través de la UI real.
test('un comprador busca un producto, lo agrega al carrito y completa el checkout', async ({ page }) => {
  const { productName } = await createVerifiedProductFixture();

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `comprador-e2e-${suffix}@example.com`;

  await gotoApp(page, '/registro');
  await page.fill('input[name="name"]', 'Comprador E2E');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', '04141234567');
  await page.fill('input[name="city"]', 'Caracas');
  await page.fill('input[name="password"]', 'password123');
  await page.fill('input[name="password2"]', 'password123');
  await page.click('#register-form button[type="submit"]');
  await page.waitForURL('**/#/', { timeout: 10_000 });

  await page.click('.bottom-nav__item[href="#/buscar"]');
  await page.fill('#search-input', productName);
  await page.press('#search-input', 'Enter');

  const resultCard = page.locator('.product-card', { hasText: productName });
  await expect(resultCard).toBeVisible({ timeout: 8_000 });
  await resultCard.locator('[data-action="add-to-cart"]').click();
  await expect(page.locator('.toast-root')).toContainText('Agregado al carrito', { timeout: 5_000 });

  await page.click('.bottom-nav__item[href="#/carrito"]');
  await expect(page.locator('.cart-row', { hasText: productName })).toBeVisible();
  await page.click('#btn-checkout');
  await page.waitForURL('**/#/checkout', { timeout: 8_000 });

  await page.fill('#checkout-form [name="address"]', 'Av. Comprador, Edif. Test, Piso 2');
  await page.click('#btn-confirm-order');

  await expect(page.locator('.confirmation-card__title')).toContainText('Pedido registrado', { timeout: 10_000 });
});

import { test, expect } from '@playwright/test';
import { gotoApp } from '../fixtures/appRoute.js';

// Camino crítico del vendedor (ver docs/ROADMAP.md, Etapa 1): una tienda
// nueva se registra y puede cargar inventario de inmediato, aunque su
// verificación quede pendiente — no depende de ningún dato sembrado.
test('un vendedor nuevo registra su tienda y agrega un producto', async ({ page }) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `vendedor-e2e-${suffix}@example.com`;
  const productName = `Producto E2E ${suffix}`;

  await gotoApp(page, '/registro');

  await page.fill('input[name="name"]', 'Vendedor E2E');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', '04121234567');
  await page.fill('input[name="city"]', 'Caracas');
  await page.fill('input[name="password"]', 'password123');
  await page.fill('input[name="password2"]', 'password123');
  await page.check('#wants-store');
  await page.fill('input[name="storeName"]', `Tienda E2E ${suffix}`);
  await page.fill('input[name="rif"]', 'J-99999999-0');
  await page.fill('input[name="responsibleName"]', 'Responsable E2E');
  await page.fill('input[name="whatsapp"]', '04121234567');
  await page.fill('input[name="address"]', 'Av. Test, Local E2E');
  await page.selectOption('select[name="state"]', 'Miranda');
  await page.click('#register-form button[type="submit"]');

  // El registro con storeName crea usuario+tienda en una sola transacción
  // (ver server/src/routes/auth.js) y manda directo al panel de vendedor.
  await page.waitForURL('**/#/vendedor', { timeout: 10_000 });

  await page.click('button[data-tab="inventario"]');
  await page.click('#btn-add-product');

  const form = page.locator('#product-form');
  await expect(form).toBeVisible();
  await form.locator('input[name="name"]').fill(productName);
  await form.locator('select[name="categoryId"]').selectOption('motor');
  await form.locator('input[name="price"]').fill('25.50');
  // La compatibilidad de vehículos es obligatoria (al menos uno) — el
  // formulario ya trae una fila vacía por defecto, solo hace falta llenarla.
  await form.locator('[name="compatBrand"]').fill('Toyota');
  await form.locator('[name="compatModel"]').fill('Corolla');
  await form.locator('button[type="submit"]').click();

  await expect(page.locator('.toast-root')).toContainText('Producto agregado', { timeout: 8_000 });
  await expect(page.locator('.inventory-row__name', { hasText: productName })).toBeVisible();
});

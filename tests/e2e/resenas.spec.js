import { test, expect } from '@playwright/test';
import { gotoApp } from '../fixtures/appRoute.js';
import { createPaidOrderFixture } from '../fixtures/paidOrderFixture.js';

// Reseñas reales ligadas a una compra pagada (ver docs/ROADMAP.md, Etapa 2,
// y server/src/routes/products.js). El fixture ya deja al comprador con un
// pedido 'pagado' de este producto — lo que este spec verifica es que, a
// partir de ahí, el formulario de reseña aparece, publicar una reseña real
// funciona de punta a punta, y que no se puede reseñar dos veces desde el
// mismo pedido.
test('un comprador que ya pagó puede reseñar el producto, y no puede reseñarlo dos veces', async ({ page }) => {
  const { buyerEmail, buyerPassword, product } = await createPaidOrderFixture();

  await gotoApp(page, '/login');
  await page.fill('input[name="email"]', buyerEmail);
  await page.fill('input[name="password"]', buyerPassword);
  await page.click('#login-form button[type="submit"]');
  await page.waitForURL('**/#/', { timeout: 10_000 });

  await page.goto(`${page.url().split('#')[0]}#/producto/${product.id}`, { waitUntil: 'load' });
  await expect(page.locator('#review-form')).toBeVisible({ timeout: 8_000 });

  await page.click('.review-form__star[data-rating="5"]');
  await page.fill('#review-form [name="comment"]', 'Excelente producto, llegó rápido y como se describía.');
  await page.click('#review-form-submit');

  await expect(page.locator('.toast-root')).toContainText('¡Gracias por tu reseña!', { timeout: 5_000 });
  await expect(page.locator('.review-row', { hasText: 'Excelente producto' })).toBeVisible();
  await expect(page.locator('#review-form')).toHaveCount(0);
  await expect(page.locator('.reviews-summary__count')).toContainText('1 reseñas');

  // Recargar confirma que la reseña quedó guardada en el backend (no sólo
  // pintada en el DOM) y que el formulario ya no vuelve a aparecer para
  // este mismo pedido.
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.review-row', { hasText: 'Excelente producto' })).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('#review-form')).toHaveCount(0);
});

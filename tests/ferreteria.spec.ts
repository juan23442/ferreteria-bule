import { test, expect } from '@playwright/test';

test('Debe cargar la página principal de la ferretería', async ({ page }) => {
  await page.goto('http://localhost:8080');

  // Verifica el título real obtenido del servidor
  await expect(page).toHaveTitle(/FERRO PINTURAS EL BULE/i);
});

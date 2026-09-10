import { test, expect } from '@playwright/test';

test('Debe cargar la página principal de la ferretería', async ({ page }) => {
  await page.goto('http://localhost:8080');

  // Verifica el título real obtenido del servidor
  await expect(page).toHaveTitle(/FERRO PINTURAS EL BULE/i);
});

test('Debe guardar un gasto y sincronizarlo con el estado compartido', async ({ page }) => {
  const syncedStates: Array<Record<string, unknown>> = [];
  await page.route('**/api/state', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Sin estado de prueba' }) });
      return;
    }

    syncedStates.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('http://localhost:8080');
  await page.getByRole('button', { name: 'Gastos' }).click();
  await page.getByRole('button', { name: '+ Registrar Gasto' }).click();
  await page.locator('#exp-desc').fill('Pago de prueba');
  await page.locator('#exp-amount').fill('150000');
  await page.getByRole('button', { name: 'Guardar Gasto' }).click();

  await expect(page.locator('#exp-tbody')).toContainText('Pago de prueba');
  await expect.poll(() => syncedStates.some(state =>
    Array.isArray(state.expenses) && state.expenses.some((expense: any) => expense.description === 'Pago de prueba')
  )).toBe(true);
});

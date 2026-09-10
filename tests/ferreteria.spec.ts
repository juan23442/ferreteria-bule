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

  await page.once('dialog', dialog => dialog.accept());
  await page.locator('#exp-tbody button').click();
  await expect(page.locator('#exp-tbody')).not.toContainText('Pago de prueba');
  await expect.poll(() => syncedStates.some(state =>
    Array.isArray(state.expenses) &&
    !state.expenses.some((expense: any) => expense.description === 'Pago de prueba') &&
    Array.isArray(state.cash_movements) &&
    !state.cash_movements.some((movement: any) => movement.concept === 'Gasto: Pago de prueba')
  )).toBe(true);
});

test('Debe eliminar movimientos directamente desde Caja', async ({ page }) => {
  await page.route('**/api/state', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Sin estado de prueba' }) });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('http://localhost:8080');
  await page.evaluate(() => {
    localStorage.setItem('fb_expenses', JSON.stringify([{
      id: 'exp_caja_test', date: '2026-09-10', category: 'Otros', description: 'Movimiento de prueba', amount: 1000
    }]));
    localStorage.setItem('fb_cash_movements', JSON.stringify([{
      id: 'cash_caja_test', expenseId: 'exp_caja_test', date: '2026-09-10', datetime: new Date().toISOString(),
      type: 'egreso', concept: 'Gasto: Movimiento de prueba', amount: 1000
    }]));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Caja' }).click();
  await expect(page.locator('#cash-tbody')).toContainText('Movimiento de prueba');

  await page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Eliminar movimiento Gasto: Movimiento de prueba' }).click();
  await expect(page.locator('#cash-tbody')).not.toContainText('Movimiento de prueba');
});

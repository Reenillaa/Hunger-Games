import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  return errors;
}

async function startNewGame(page: Page, query = '') {
  await page.goto(`./${query}`);
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await expect(page.getByTestId('top-bar')).toBeVisible();
}

test('boots, starts a new game and renders the district', async ({ page }) => {
  const errors = trackErrors(page);
  await startNewGame(page);
  await expect(page.getByTestId('date')).toContainText('Año 1 · Primavera · Día 1');
  // The clock runs from the start: allow a few in-game hours to pass before this check.
  await expect(page.getByTestId('countdown')).toContainText(/La Criba en 20 d [0-4] h/);
  await expect(page.getByTestId('game-canvas').locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('speed controls change the clock state', async ({ page }) => {
  await startNewGame(page);
  const pause = page.getByRole('button', { name: 'Pausa' });
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  const fastest = page.getByRole('button', { name: 'Velocidad cuádruple' });
  await fastest.click();
  await expect(fastest).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('date')).not.toContainText('· 08:00', { timeout: 15000 });
});

test('a manual save survives a page reload', async ({ page }) => {
  await startNewGame(page, '?debug');
  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: '+1 día' }).click();
  await page.getByRole('button', { name: '+1 día' }).click();
  const savedDate = (await page.getByTestId('date').textContent()) ?? '';
  expect(savedDate).toContain('Día 3');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByTestId('slot-slot-1').getByRole('button', { name: 'Guardar aquí' }).click();
  await expect(page.getByTestId('toast')).toHaveText('Partida guardada');

  await page.reload();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.getByTestId('date')).toContainText(
    savedDate.split(' · ').slice(0, 3).join(' · '),
  );
});

test('walking skeleton: district → selection → capital → arena → return', async ({ page }) => {
  const errors = trackErrors(page);
  await startNewGame(page, '?debug');
  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Ir a la Criba' }).click();
  // The ceremony plays first (built from the real draw) and can be skipped.
  await expect(page.getByTestId('cinematic')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.getByTestId('cinematic')).toHaveCount(0);

  const sheet = page.getByTestId('phase-sheet');
  await expect(sheet).toHaveAttribute('data-phase', 'selection');
  await expect(page.getByTestId('date')).toContainText('Otoño · Día 1');
  await expect(sheet).toContainText('Ofrendas:');
  await sheet.getByRole('button', { name: 'Partir hacia Áurea' }).click();

  const capital = page.getByTestId('capital');
  for (let day = 1; day <= 7; day++) {
    await expect(capital).toContainText(`Día ${day} de 7`);
    // Make the first offered choice for every contestant, then end the day.
    const contestants = capital.getByTestId('contestant');
    for (let i = 0; i < (await contestants.count()); i++) {
      await contestants.nth(i).locator('button[aria-pressed]').first().click();
    }
    await capital.getByRole('button', { name: day < 7 ? 'Terminar el día' : 'A la arena' }).click();
  }
  await expect(sheet).toHaveAttribute('data-phase', 'arena');
  await sheet.getByRole('button', { name: /Cerrar los juegos/ }).click();
  await expect(sheet).toHaveAttribute('data-phase', 'aftermath');
  await expect(sheet).toContainText('7 días fuera');
  await sheet.getByRole('button', { name: 'Volver al distrito' }).click();

  await expect(page.getByTestId('phase-sheet')).toHaveCount(0);
  await expect(page.getByTestId('date')).toContainText('Otoño · Día 8');
  await expect(page.getByTestId('countdown')).toContainText('La Criba en 33 d');
  expect(errors).toEqual([]);
});

test('exports a backup and imports it back', async ({ page }) => {
  await startNewGame(page, '?debug');
  await page.getByRole('button', { name: 'Pausa' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '+1 día' }).click();
  await expect(page.getByTestId('date')).toContainText('Día 5');

  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar copia de seguridad' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^diezmo-a1-spring-d5\.diezmo$/);
  const file = await download.path();

  // Start over in a clean browser storage and import the file.
  await page.evaluate(() => indexedDB.deleteDatabase('diezmo'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Cargar partida' }).click();
  await page.getByTestId('import-input').setInputFiles(file);
  await expect(page.getByTestId('date')).toContainText('Primavera · Día 5');
});

test('economy HUD, build menu and construction', async ({ page }) => {
  const errors = trackErrors(page);
  await startNewGame(page, '?debug');
  await page.getByRole('button', { name: 'Pausa' }).click();
  await expect(page.getByTestId('res-food')).toBeVisible();
  const wood = Number(await page.getByTestId('res-wood').textContent());

  await page.getByRole('button', { name: 'Construir' }).click();
  await page.getByRole('menuitem', { name: /Huerto comunal/ }).click();
  await expect(page.getByTestId('place-hint')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('place-hint')).toHaveCount(0);

  // Place through the session (positions on screen depend on the viewport).
  const placed = await page.evaluate(() => {
    const d = (
      window as unknown as {
        __diezmo: {
          session: { dispatch: (c: unknown) => { ok: boolean } };
          findSpot: (k: string) => { x: number; y: number };
        };
      }
    ).__diezmo;
    const spot = d.findSpot('garden');
    return d.session.dispatch({ type: 'build/place', kind: 'garden', ...spot }).ok;
  });
  expect(placed).toBe(true);
  await expect(page.getByTestId('res-wood')).toHaveText(String(wood - 15));
  expect(errors).toEqual([]);
});

test('population list and citizen sheet with family links', async ({ page }) => {
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Población' }).click();
  const list = page.getByTestId('population-list');
  await expect(list.getByRole('button').first()).toBeVisible();
  expect(await list.getByRole('button').count()).toBeGreaterThan(80);
  await page.getByRole('button', { name: 'Todos' }).click();
  const eligible = await list.getByRole('button').count();
  expect(eligible).toBeGreaterThan(5);
  expect(eligible).toBeLessThan(60);
  await list.getByRole('button').first().click();
  await expect(page.getByTestId('citizen-card')).toBeVisible();
  await expect(page.getByText('Personalidad').or(page.getByText('Atributos'))).toBeVisible();
  expect(errors).toEqual([]);
});

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
  // A new game opens with the prologue; the clock waits until it ends or is skipped.
  await expect(page.getByTestId('cinematic')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.getByTestId('cinematic')).toHaveCount(0);
}

test('boots, starts a new game and renders the district', async ({ page }) => {
  const errors = trackErrors(page);
  await startNewGame(page);
  await expect(page.getByTestId('date')).toContainText('Año 1 · Primavera · Día 1');
  // The clock runs from the start: allow a few in-game hours to pass before this check.
  await expect(page.getByTestId('countdown')).toContainText(/La Cosecha en 20 d [0-4] h/);
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
  await page.getByRole('button', { name: 'Ir a la Cosecha' }).click();
  // The ceremony plays first (built from the real draw) and can be skipped.
  await expect(page.getByTestId('cinematic')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.getByTestId('cinematic')).toHaveCount(0);

  const sheet = page.getByTestId('phase-sheet');
  await expect(sheet).toHaveAttribute('data-phase', 'selection');
  await expect(page.getByTestId('date')).toContainText('Otoño · Día 1');
  await expect(sheet).toContainText('Ofrendas:');
  await sheet.getByRole('button', { name: 'Partir hacia el Capitolio' }).click();

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
  // The arena: play a few rounds, then let the games resolve without the player.
  const arena = page.getByTestId('arena');
  await expect(arena).toBeVisible();
  await expect(page.getByTestId('arena-clock')).toContainText('Día 1');
  // On small screens the panel starts folded so the map stays visible.
  const expand = arena.getByRole('button', { name: 'Mostrar panel' });
  if (await expand.isVisible()) await expand.click();
  await expect(arena.getByTestId('arena-member').first()).toBeVisible();
  await arena.getByRole('button', { name: 'Prudente' }).click();
  await expect(arena.getByRole('button', { name: 'Prudente' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await arena.getByRole('button', { name: /Cerrar los juegos/ }).click();
  await expect(sheet).toHaveAttribute('data-phase', 'aftermath');
  const body = (await sheet.textContent()) ?? '';
  const away = Number(/tras (\d+) días fuera/.exec(body)?.[1]);
  expect(away).toBeGreaterThan(7);
  await sheet.getByRole('button', { name: 'Volver al distrito' }).click();
  // The return ceremony (built from the results) plays and can be skipped.
  await expect(page.getByTestId('cinematic')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar' }).click();

  await expect(page.getByTestId('phase-sheet')).toHaveCount(0);
  const seasons = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
  const season = seasons[(2 + Math.floor(away / 10)) % 4]!;
  await expect(page.getByTestId('date')).toContainText(`${season} · Día ${(away % 10) + 1}`);
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
  expect(await list.getByRole('button').count()).toBeGreaterThan(40);
  await page.getByRole('button', { name: 'Todos' }).click();
  const eligible = await list.getByRole('button').count();
  expect(eligible).toBeGreaterThan(5);
  expect(eligible).toBeLessThan(40);
  await list.getByRole('button').first().click();
  await expect(page.getByTestId('citizen-card')).toBeVisible();
  await expect(page.getByText('Personalidad').or(page.getByText('Atributos'))).toBeVisible();
  expect(errors).toEqual([]);
});

test('settings, chronicle and the world map', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  // Every district and the Capitol can be inspected on the map.
  await page.getByRole('button', { name: 'Distrito 5' }).click();
  await expect(page.getByTestId('place-card')).toContainText('Distrito 5');
  // All twelve districts are playable; the Capitol can only be inspected.
  await expect(page.getByTestId('place-card')).toContainText('Jugable');
  await expect(page.getByTestId('place-trade')).toContainText('Cuota: Carbón');
  await page.getByRole('button', { name: 'Distrito 10', exact: true }).click();
  await expect(page.getByTestId('place-card')).toContainText('Jugable');
  await expect(page.getByTestId('place-trade')).toContainText('Cuota: Comida');
  await page.getByRole('button', { name: 'El Capitolio' }).click();
  await expect(page.getByTestId('place-card')).toContainText('Capital');
  await expect(page.getByTestId('place-card').getByRole('button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Distrito 12' }).click();
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Saltar' }).click();
  // Settings persist per device.
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByTestId('settings').getByRole('button', { name: 'Grande', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('style', /--ui-zoom: 1.15/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Crónica' }).click();
  await expect(page.getByTestId('chronicle')).toContainText('Todavía no ha habido ninguna Cosecha');
  expect(errors).toEqual([]);
});

test('a new game in the coastal district from the map', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Distrito 4' }).click();
  await expect(page.getByTestId('place-card')).toContainText('Jugable');
  await expect(page.getByTestId('place-trade')).toContainText('Cuota: Comida');
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await expect(page.getByTestId('cinematic')).toBeVisible();
  await expect(page.getByTestId('cinematic')).toContainText('Distrito 4');
  await page.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.getByTestId('top-bar')).toContainText('Distrito 4');
  await expect(page.getByTestId('game-canvas').locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Construir' }).click();
  await expect(page.getByRole('menuitem', { name: /Lonja/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a new game in the grain district (generated plan and regional architecture)', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Distrito 9' }).click();
  await expect(page.getByTestId('place-trade')).toContainText('Cuota: Comida');
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.getByTestId('top-bar')).toContainText('Distrito 9');
  await expect(page.getByTestId('game-canvas').locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Construir' }).click();
  await expect(page.getByRole('menuitem', { name: /Granja/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('district laws are decrees: open the scroll, sign it and send it', async ({
  page,
  isMobile,
}) => {
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Leyes' }).click();
  const laws = page.getByTestId('laws');
  const shifts = laws.getByRole('button', { name: /Jornada larga/ });
  await expect(shifts).toHaveAttribute('aria-pressed', 'false');
  await shifts.click();
  const decree = page.getByTestId('decree');
  await expect(decree).toContainText('Producción +15 %');
  const send = decree.getByRole('button', { name: 'Sellar y enviar' });
  await expect(send).toBeDisabled();
  // Sign by hand on the pad: a scribble is enough ink.
  // Wait until the scroll has finished unrolling before signing on it.
  await expect
    .poll(() =>
      decree
        .locator('article')
        .evaluate((el) => el.getAnimations().every((a) => a.playState === 'finished')),
    )
    .toBe(true);
  const pad = page.getByTestId('signature-pad');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  const pts = Array.from({ length: 13 }, (_, i) => ({
    x: box.x + 20 + i * (box.width / 15),
    y: box.y + box.height * (i % 2 ? 0.3 : 0.7),
  }));
  if (isMobile) {
    // A finger on the glass: real touch events.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]!] });
    for (const pt of pts.slice(1))
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(pts[0]!.x, pts[0]!.y);
    await page.mouse.down();
    for (const pt of pts.slice(1)) await page.mouse.move(pt.x, pt.y);
    await page.mouse.up();
  }
  await expect(send).toBeEnabled();
  await send.click();
  await expect(laws.getByRole('button', { name: /Jornada larga/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(errors).toEqual([]);
});

test('three taps on the clock jump to the Reaping, filmed shot by shot', async ({ page }) => {
  const errors = trackErrors(page);
  await startNewGame(page);
  await page.getByTestId('clock-dial').click({ clickCount: 3 });
  await expect(page.getByTestId('cinematic')).toBeVisible();
  // The guards close the plaza, then the herald from the Capitol speaks.
  await expect(page.locator('[data-shot="guard"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-shot="herald"]')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.getByTestId('cinematic')).toHaveCount(0);
  await expect(page.getByTestId('phase-sheet')).toContainText('La Cosecha');
  expect(errors).toEqual([]);
});

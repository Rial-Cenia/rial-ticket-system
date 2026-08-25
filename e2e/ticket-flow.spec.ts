import { expect, test } from '@playwright/test';

test('login presenta las dos vías de autenticación', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: 'Ticketera Rial' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continuar con Google' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});

test.describe('flujo autenticado de tickets', () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'Requiere una cuenta Supabase preaprovisionada en E2E_EMAIL y E2E_PASSWORD',
  );

  test('crea, filtra, arrastra, edita, consulta en tabla y elimina', async ({
    page,
  }) => {
    const title = `Ticket E2E ${Date.now()}`;
    const editedTitle = `${title} editado`;

    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_EMAIL!);
    await page.getByLabel('Contraseña').fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/kanban$/);

    await page.getByRole('button', { name: 'Nuevo ticket' }).click();
    await page.getByLabel('Título').fill(title);
    await page
      .getByLabel('Descripción')
      .fill('Ticket creado por el flujo completo de Playwright.');
    await page.getByRole('button', { name: 'Crear ticket' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText(/^RTP-\d+$/).first()).toBeVisible();

    const search = page.getByPlaceholder(
      'Buscar código, título, descripción o creador',
    );
    await search.fill(title);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await search.fill('sin-coincidencias-e2e');
    await expect(page.getByRole('heading', { name: title })).toBeHidden();
    await search.fill('');

    const handle = page.getByRole('button', { name: `Arrastrar ${title}` });
    const target = page
      .getByRole('heading', { name: 'En staging' })
      .locator('xpath=ancestor::section');
    const handleBox = await handle.boundingBox();
    const targetBox = await target.boundingBox();
    expect(handleBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + 80,
      { steps: 12 },
    );
    await page.mouse.up();
    const movedTicket = target.getByRole('heading', { name: title });
    await expect(movedTicket).toBeVisible();

    await page
      .getByRole('button', { name: `Abrir detalle de ${title}` })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Detalle del ticket' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Editar ticket' }).click();
    await page.getByLabel('Título').fill(editedTitle);
    await page.getByRole('button', { name: 'Guardar' }).click();

    await page.getByRole('link', { name: 'Tabla' }).click();
    await expect(page.getByText(editedTitle)).toBeVisible();
    await page.getByText(editedTitle).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText(editedTitle)).toBeHidden();
  });
});

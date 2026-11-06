import { expect, test, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProjectData } from '../../packages/schema/src/index.ts';

const artifacts = path.resolve(import.meta.dirname, '../../artifacts/qa');
async function project(page: Page): Promise<ProjectData> {
  return (await page.request.get('/api/project')).json();
}
async function openProject(page: Page, root: string) {
  await page.getByLabel('Manage projects').click();
  await page.getByLabel('Project directory').fill(root);
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'All assets.' })).toBeVisible();
}
async function newFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await page.getByLabel('Folder name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save folder', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  return (await project(page)).context.collections.find((c) => c.name === name)!;
}
test('Project tree browses static and animated assets, variants, real rig nodes, clips and states', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.asset-card')).toHaveCount(11);
  await expect(page.getByTestId('preview-stage')).not.toBeVisible();
  await page.getByRole('button', { name: 'Animated 5', exact: true }).click();
  await expect(page.locator('.asset-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Static 6', exact: true }).click();
  await expect(page.locator('.asset-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'All 11', exact: true }).click();
  await page.getByLabel('Expand Devices', { exact: true }).click();
  await page.getByLabel('Expand Phone family', { exact: true }).click();
  await page.getByLabel('Expand Phone · single camera', { exact: true }).click();
  await page.getByTestId('tree-variants:phone-single-camera').click();
  await page.getByTestId('tree-entity:phone-triple-camera').click();
  await expect(page.getByTestId('preview-stage').locator('svg')).toBeVisible();
  await expect(page.getByTestId('tree-entity:phone-triple-camera')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByLabel('Search project tree').fill('walk');
  await page.getByTestId('tree-animation:walk').click();
  await expect(page.getByLabel('Select animation')).toHaveValue('walk');
  await expect(page.locator('.motion-grid > button')).toHaveCount(8);
  await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
  await expect
    .poll(async () => Number(await page.getByLabel('Animation time').inputValue()))
    .toBeGreaterThan(0.05);
  await page.getByLabel('Pause animation', { exact: true }).click();
  const idle = page.locator('.motion-grid > button').filter({ hasText: 'idle' });
  await idle.click();
  await expect(page.getByLabel('Select animation')).toHaveValue('idle');
  await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
  await page.getByLabel('Pause animation', { exact: true }).click();
  await idle.click();
  await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
  await page.getByLabel('Search project tree').fill('leafLeft');
  await page.getByTestId('tree-rig:studio-plant:leafLeft').click();
  await expect(page.locator('.node-list > button.selected')).toContainText('leafLeft');
  await expect(page.getByTestId('preview-stage').locator('#leaf-left')).toHaveAttribute(
    'style',
    /drop-shadow/,
  );
  await page.getByLabel('Search project tree').fill('maker-states');
  await page.getByTestId('tree-machine:maker-states').click();
  await expect(page.getByLabel('Source editor')).toHaveValue(/maker-states/);
  await page.getByLabel('Close dialog').click();
  await page.getByLabel('Search project tree').fill('');
  await page.getByTestId('tree-project').click();
  await page.getByTestId('tree-project').press('ArrowDown');
  await expect(page.getByTestId('tree-category:Devices')).toBeFocused();
  await page.getByTestId('tree-category:Devices').press('ArrowLeft');
  await expect(page.getByTestId('tree-category:Devices')).toHaveAttribute('aria-expanded', 'false');
  await page.getByTestId('tree-category:Devices').press('ArrowRight');
  await expect(page.getByTestId('tree-category:Devices')).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'project-library.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('Custom nested folders persist, rename and reparent while preserving SVG, rig and exports', async ({
  page,
}) => {
  const original = await project(page),
    temp = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'vectorforge-folders-'));
  const root = path.join(temp, 'game');
  await fs.cp(original.root, root, { recursive: true, filter: (f) => !f.includes('/exports') });
  try {
    await page.goto('/');
    await openProject(page, root);
    const parent = await newFolder(page, 'My game');
    await page.getByRole('button', { name: 'Edit folder', exact: true }).click();
    await expect(page.getByLabel('Parent folder', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Save folder', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const child = await newFolder(page, 'Props');
    expect(child.parentId).toBe(parent.id);
    await page.getByTestId('tree-project').click();
    await page.getByTestId('asset-card-phone-triple-camera').click();
    await page.getByLabel('Asset folder', { exact: true }).selectOption(child.id);
    await expect
      .poll(
        async () =>
          (await project(page)).assets.find((a) => a.metadata.id === 'phone-triple-camera')
            ?.metadata.collection,
      )
      .toBe(child.id);
    await page.getByTestId('tree-project').click();
    await page.getByTestId('asset-card-studio-plant').click();
    await page.getByLabel('Asset folder', { exact: true }).selectOption(child.id);
    await expect
      .poll(
        async () =>
          (await project(page)).actors.find((a) => a.metadata.id === 'studio-plant')?.metadata
            .collection,
      )
      .toBe(child.id);
    await page.getByTestId(`tree-collection:${parent.id}`).click();
    await expect(page.locator('.asset-card')).toHaveCount(2);
    await page.getByTestId(`folder-card-collection:${child.id}`).click();
    await expect(page.locator('.asset-card')).toHaveCount(2);
    await expect(page.getByTestId('preview-stage')).not.toBeVisible();
    await page.getByRole('button', { name: 'Edit folder', exact: true }).click();
    await page.getByLabel('Folder name', { exact: true }).fill('Shared props');
    await page.getByLabel('Parent folder', { exact: true }).selectOption('');
    await page.getByRole('button', { name: 'Save folder', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shared props.' })).toBeVisible();
    await page.reload();
    await page.getByTestId(`tree-collection:${child.id}`).click();
    await expect(page.locator('.asset-card')).toHaveCount(2);
    await page.getByTestId('asset-card-studio-plant').click();
    await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
    await page.getByLabel('Pause animation', { exact: true }).click();
    await page.getByRole('button', { name: 'Export asset', exact: true }).click();
    await page.getByRole('button', { name: 'Dry run', exact: true }).click();
    await expect(page.locator('.export-plan')).toContainText('actors/studio-plant/rig.json');
    await expect(page.getByRole('button', { name: 'Write export' })).toBeEnabled();
    await page.getByRole('button', { name: 'Write export' }).click();
    await expect(page.getByRole('status')).toContainText('Export written successfully');
    await page.getByLabel('Close dialog').click();
    const current = await project(page),
      plant = current.actors.find((a) => a.metadata.id === 'studio-plant')!;
    expect(plant.svg).toBe(original.actors.find((a) => a.metadata.id === 'studio-plant')!.svg);
    expect(plant.rig).toEqual(original.actors.find((a) => a.metadata.id === 'studio-plant')!.rig);
    expect(current.issues).toEqual([]);
    const exported = JSON.parse(
      await fs.readFile(path.join(root, 'exports/generic/vectorforge.context.json'), 'utf8'),
    );
    expect(exported.collections.find((c: { id: string }) => c.id === child.id).name).toBe(
      'Shared props',
    );
    await fs.writeFile(
      path.join(root, 'vectorforge.context.json'),
      JSON.stringify(
        {
          ...current.context,
          collections: current.context.collections.map((c) =>
            c.id === child.id ? { ...c, name: 'Props on disk' } : c,
          ),
        },
        null,
        2,
      ),
    );
    await expect(page.getByTestId(`tree-collection:${child.id}`)).toContainText('Props on disk');
    await page.getByTestId(`tree-collection:${child.id}`).click();
    await expect(page.getByRole('heading', { name: 'Props on disk.' })).toBeVisible();
    await openProject(page, original.root);
    await expect(page.locator('.asset-card')).toHaveCount(11);
    await expect(page.getByTestId(`tree-collection:${child.id}`)).not.toBeVisible();
    await page.locator('.recent-project').filter({ hasText: current.project.name }).click();
    await expect.poll(async () => (await project(page)).root).toBe(root);
    await expect(page.getByTestId(`tree-collection:${child.id}`)).toBeVisible();
  } finally {
    await page.request.post('/api/open', { data: { path: original.root } });
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('Creating an independent project protects existing directories and starts with an empty library', async ({
  page,
}) => {
  const original = await project(page),
    temp = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'vectorforge-projects-'));
  try {
    await page.goto('/');
    await page.getByLabel('Add project').click();
    await page.getByRole('button', { name: 'Create new', exact: true }).click();
    await page.getByLabel('New project name').fill('My website');
    await page.getByLabel('Project directory').fill(original.root);
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Existing files are protected');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await project(page)).root).toBe(original.root);
    const root = path.join(temp, 'website');
    await page.getByLabel('Project directory').fill(root);
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.asset-card')).toHaveCount(0);
    await expect(page.getByText('This folder is ready for your first asset.')).toBeVisible();
    expect((await project(page)).project.name).toBe('My website');
    await newFolder(page, 'Brand illustrations');
    await expect(page.getByRole('heading', { name: 'Brand illustrations.' })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('treeitem', { name: 'Brand illustrations 0', exact: true }),
    ).toBeVisible();
    const checked = await page.request.post('/api/validate', { data: {} });
    expect(await checked.json()).toEqual([]);
    await page.locator('.recent-project').filter({ hasText: original.project.name }).click();
    await expect(page.locator('.asset-card')).toHaveCount(11);
  } finally {
    await page.request.post('/api/open', { data: { path: original.root } });
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('Mobile project drawer selects folders and closes without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Toggle project tree').click();
  await expect(page.locator('.sidebar.mobile-open')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.getByLabel('Manage projects').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Close dialog').click();
  await page.getByTestId('tree-category:Nature').click();
  await expect(page.locator('.sidebar.mobile-open')).toHaveCount(0);
  await expect(page.locator('.asset-card')).toHaveCount(1);
  await page.getByTestId('asset-card-studio-plant').click();
  await expect(page.getByTestId('preview-stage').locator('svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'project-mobile.png'), fullPage: true });
  await page.getByLabel('Toggle project tree').click();
  await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.screenshot({ path: path.join(artifacts, 'project-mobile-tree.png') });
});

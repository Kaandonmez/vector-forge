import { expect, test, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { defaultProject, readProject, safePath } from '../../packages/core/src/index.ts';
import { exportProject } from '../../packages/exporters/index.ts';
const artifacts = path.resolve(import.meta.dirname, '../../artifacts/qa');
async function browse(page: Page, name: string) {
  const views = page.locator('.quick-views');
  if (!(await views.evaluate((e) => (e as HTMLDetailsElement).open)))
    await views.locator('summary').click();
  await page.getByRole('button', { name, exact: true }).click();
}
async function seekTo(page: Page, time: number) {
  await page.getByLabel('Animation time').evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      element,
      String(value),
    );
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, time);
}
test.beforeAll(async () => {
  await fs.mkdir(artifacts, { recursive: true });
});
test('Initial motion previews autoplay while snapshots keep their requested time', async ({
  page,
}) => {
  for (const id of ['studio-plant', 'gentle-sway', 'idea-to-board']) {
    await page.goto(`/?selected=${id}`);
    await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
    await expect
      .poll(async () => Number(await page.getByLabel('Animation time').inputValue()))
      .toBeGreaterThan(0.05);
    await page.getByLabel('Pause animation', { exact: true }).click();
    await expect(page.getByLabel('Play animation', { exact: true })).toBeVisible();
  }
  await page.goto('/?snapshot=studio-plant&clip=gentle-sway&time=1');
  await expect(page.locator('#snapshot-stage [data-vf-node="leafLeft"]')).toBeAttached();
  const leaf = page.locator('#snapshot-stage [data-vf-node="leafLeft"]');
  const pose = await leaf.getAttribute('transform');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await leaf.getAttribute('transform')).toBe(pose);
});
test('Studio loads the project, browses every SVG and searches variants', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'All assets.' })).toBeVisible();
  await browse(page, 'Assets');
  await expect(page.getByTestId('preview-stage').locator('svg')).toBeVisible();
  for (const id of [
    'phone-single-camera',
    'phone-dual-camera',
    'phone-triple-camera',
    'phone-foldable-dual-camera',
    'phone-foldable-triple-camera',
    'phone-ink',
  ]) {
    await page.getByTestId(`asset-card-${id}`).click();
    await expect(page.getByTestId('preview-stage').locator('svg')).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, `${id}.png`) });
  }
  await page.getByRole('button', { name: 'Phone family 5' }).click();
  await expect(page.locator('.asset-card')).toHaveCount(5);
  await page.getByLabel('Search library').fill('foldable');
  await expect(page.locator('.asset-card')).toHaveCount(2);
  await page.getByLabel('Search library').fill('absent');
  await expect(page.getByText('No assets match')).toBeVisible();
  await page.getByLabel('Reset library filters').click();
  await page.getByTestId('asset-card-phone-triple-camera').click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'studio.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('Generic object motion plays, pauses, seeks and exposes independent rig nodes', async ({
  page,
}) => {
  await page.goto('/');
  await browse(page, 'Actors');
  for (const [id, clip, node] of [
    ['studio-plant', 'gentle-sway', 'leafLeft'],
    ['signal-chip', 'activity', 'indicator3'],
    ['energy-core', 'boost', 'energy1'],
  ] as const) {
    await page.getByTestId(`asset-card-${id}`).click();
    await page.getByLabel('Select animation').selectOption(clip);
    const selectedNode = page.getByTestId('preview-stage').locator(`[data-vf-node="${node}"]`);
    await expect(selectedNode).toBeAttached();
    const before = await selectedNode.getAttribute('transform');
    await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
    await expect.poll(() => selectedNode.getAttribute('transform')).not.toBe(before);
    await page.getByLabel('Pause animation', { exact: true }).click();
    await seekTo(page, 1);
    await expect.poll(() => selectedNode.getAttribute('transform')).not.toBe(before);
    await page.getByLabel('Playback speed').selectOption('0.5');
    await page.getByLabel('Zoom in').click();
    await expect(page.getByText('125%', { exact: true })).toBeVisible();
    await page.getByLabel('Fit preview').click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, `${id}.png`), fullPage: true });
  }
  await page.getByTestId('asset-card-studio-plant').click();
  await expect(
    page
      .getByTestId('preview-stage')
      .locator('[data-vf-node="pot"] [data-vf-node="stem"] [data-vf-node="leafLeft"]'),
  ).toBeAttached();
});
test('Every human clip moves, state events work and the full sequence reveals its drawing', async ({
  page,
}) => {
  await page.goto('/');
  await browse(page, 'Actors');
  await page.getByTestId('asset-card-studio-maker').click();
  for (const id of ['idle', 'walk', 'typing', 'talk', 'nod', 'point', 'write', 'celebrate']) {
    await page.getByLabel('Select animation').selectOption(id);
    await page.getByLabel('Pause animation', { exact: true }).click();
    await seekTo(page, 0.7);
    await expect.poll(() => page.locator('.preview-footer').textContent()).toContain('0.70s');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, `maker-${id}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'walk', exact: true }).click();
  await expect(page.getByLabel('Select animation')).toHaveValue('walk');
  await page.getByRole('button', { name: 'stop', exact: true }).click();
  await expect(page.getByLabel('Select animation')).toHaveValue('idle');
  await page.getByRole('button', { name: 'celebrate', exact: true }).click();
  await expect(page.getByLabel('Select animation')).toHaveValue('celebrate');
  await expect(page.getByLabel('Select animation')).toHaveValue('idle', { timeout: 6000 });
  await browse(page, 'Sequences');
  await expect(page.getByTestId('preview-stage').locator('svg')).toHaveAttribute(
    'viewBox',
    '0 0 720 400',
  );
  await seekTo(page, 5);
  await expect
    .poll(() => page.getByTestId('preview-stage').locator('#drawing').getAttribute('opacity'))
    .toBe('1');
  await page.getByLabel('Play animation', { exact: true }).click();
  await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
  await page.getByLabel('Pause animation', { exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'sequence.png'), fullPage: true });
  await page.getByLabel('Select animation').selectOption('scene-talk');
  await expect(page.getByLabel('Pause animation', { exact: true })).toBeVisible();
  await expect(page.locator('.sequence-label')).toHaveCount(0);
});
test('Styles, validation, source editing safeguards, snapshot and export plans are usable', async ({
  page,
}) => {
  await page.goto('/');
  await browse(page, 'Styles');
  await expect(page.getByRole('heading', { name: 'Botanical editorial' })).toBeVisible();
  await page.getByRole('button', { name: /Ink & paper/ }).click();
  await expect(page.getByRole('heading', { name: 'Ink & paper' })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'styles.png'), fullPage: true });
  await page.getByRole('button', { name: 'Validation', exact: true }).click();
  await expect(page.getByText('Everything checks out')).toBeVisible();
  await browse(page, 'Assets');
  await page.getByRole('button', { name: 'View source', exact: true }).first().click();
  const editor = page.getByLabel('Source editor');
  const original = await editor.inputValue();
  await editor.fill('<svg><script/></svg>');
  await page.getByRole('button', { name: 'Validate & save' }).click();
  await expect(page.getByRole('status')).toContainText('Unsupported SVG');
  await editor.fill(original);
  await page.getByRole('button', { name: 'Validate & save' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  await page.getByLabel('Close dialog').click();
  await page.getByLabel('Capture snapshot').click();
  await expect(page.getByRole('status')).toContainText('Snapshot saved', { timeout: 30000 });
  await page.getByRole('button', { name: 'Export asset', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Write export' })).toBeDisabled();
  await page.getByRole('button', { name: 'Dry run' }).click();
  await expect(page.getByRole('button', { name: 'Write export' })).toBeEnabled();
  await expect(page.locator('.export-plan')).toContainText('assets/phone-triple-camera/asset.svg');
  await page.getByLabel('Close dialog').click();
});
test('External file edits reload the preview and malformed JSON is reported', async ({ page }) => {
  const temp = await fs.mkdtemp('/private/tmp/vectorforge-browser-');
  const response = await page.request.get('/api/project');
  const originalProject = await response.json();
  const root = path.join(temp, 'project');
  await fs.cp(originalProject.root, root, {
    recursive: true,
    filter: (f) => !f.includes('/exports'),
  });
  try {
    await page.request.post('/api/open', { data: { path: root } });
    await page.goto('/?selected=phone-triple-camera');
    const file = path.join(root, 'assets/phone-triple-camera/asset.svg');
    const original = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, original.replace('#9ab59c', '#c7b8ef'));
    await expect
      .poll(() => page.getByTestId('preview-stage').locator('svg').innerHTML())
      .toContain('#c7b8ef');
    await fs.writeFile(path.join(root, 'animations/bad.json'), '{malformed');
    await page.getByRole('button', { name: 'Validation', exact: true }).click();
    await expect(page.getByText('animations/bad.json', { exact: true })).toBeVisible();
  } finally {
    await page.request.post('/api/open', { data: { path: originalProject.root } });
    await fs.rm(temp, { recursive: true, force: true });
  }
});
test('Mobile layout has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?selected=phone-triple-camera');
  await expect(page.getByTestId('preview-stage').locator('svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
});
test('Rig reparenting retains authored transforms and opacity tracks override a hidden node', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(
    async (modulePath) => {
      const { SvgRenderer } = await import(modulePath);
      const container = document.createElement('div');
      container.style.width = '100px';
      container.style.height = '100px';
      document.body.appendChild(container);
      const renderer = new SvgRenderer(
        container,
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="root" transform="translate(10 0)"><rect width="10" height="10"/></g><g transform="translate(50 0)"><rect id="child" width="10" height="10" opacity="0"/></g></svg>',
        {
          schemaVersion: 1,
          actorId: 'object',
          nodes: {
            root: { svgId: 'root', pivot: [0.5, 0.5], pivotSpace: 'normalized' },
            child: { svgId: 'child', parent: 'root', pivot: [0.5, 0.5], pivotSpace: 'normalized' },
          },
        },
      );
      renderer.apply({});
      const child = container.querySelector('#child') as SVGGraphicsElement;
      const initial = child.getCTM()!.e;
      renderer.apply({ root: { 'position.x': 20 }, child: { opacity: 0.75 } });
      const moved = child.getCTM()!.e,
        opacity = child.getAttribute('opacity');
      container.remove();
      return { initial, moved, opacity };
    },
    '/@fs/' + path.resolve(import.meta.dirname, '../../packages/renderer-web/src/index.ts'),
  );
  expect(result.initial).toBe(50);
  expect(result.moved).toBe(70);
  expect(result.opacity).toBe('0.75');
});
test('A standalone web export renders and animates without the Studio server', async ({ page }) => {
  const root = await fs.mkdtemp('/private/tmp/vectorforge-web-consumer-');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await exportProject(await readProject(defaultProject), root, {
    format: 'web',
    id: 'studio-plant',
  });
  const server = createServer(async (req, res) => {
    try {
      const name = new URL(req.url ?? '/', 'http://localhost').pathname.slice(1) || 'index.html';
      const file = await safePath(root, name);
      res.setHeader(
        'Content-Type',
        name.endsWith('.js')
          ? 'text/javascript'
          : name.endsWith('.svg')
            ? 'image/svg+xml'
            : name.endsWith('.json')
              ? 'application/json'
              : 'text/html',
      );
      res.end(await fs.readFile(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  try {
    await page.goto(`http://127.0.0.1:${address.port}`);
    await expect(page.locator('#stage svg')).toBeVisible();
    const leaf = page.locator('[data-vf-node="leafLeft"]');
    const before = await leaf.getAttribute('transform');
    await expect.poll(() => leaf.getAttribute('transform')).not.toBe(before);
    expect(errors).toEqual([]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(root, { recursive: true, force: true });
  }
});

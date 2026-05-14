import { expect, test } from '@playwright/test';
import { installAuth, registerOrdinaryUser, registerUser, screenshotPath } from './helpers.js';

test('生成盒子 -> 预览 -> 调参 -> 保存 -> 发布 -> 分享 -> 导出 STL', async ({ page, request }, testInfo) => {
  const auth = await registerOrdinaryUser(request);
  await installAuth(page, auth);
  await page.goto('/');

  await page.getByPlaceholder('例如：生成一个 50x30x20mm 的长方形盒子').fill('生成一个 40x30x20mm 的盒子');
  await page.getByRole('button', { name: '提交 AI 建模请求' }).click();
  await expect(page.getByText('待应用变更')).toBeVisible();
  await page.getByRole('button', { name: '应用 AI 生成代码' }).click();
  await expect(page.locator('.viewer-toolbar', { hasText: 'tris' })).toBeVisible();

  const firstNumber = page.locator('.parameter-panel input[type="number"]').first();
  await expect(firstNumber).toBeVisible();
  await firstNumber.fill('60');
  await firstNumber.blur();

  await page.getByRole('button', { name: '保存当前模型' }).click();
  await expect(page.locator('.toast', { hasText: '模型已保存' })).toBeVisible();
  await page.getByRole('button', { name: '发布当前模型到市场' }).click();
  await expect(page.locator('.toast', { hasText: '模型已发布到市场' })).toBeVisible();
  await page.getByRole('button', { name: '创建当前模型分享链接' }).click();
  await expect(page.locator('.toast', { hasText: /分享链接/ })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '预览并导出 STL 文件' }).click();
  await expect(page.getByRole('dialog', { name: '导出预览' })).toBeVisible();
  await expect(page.getByText('三角面')).toBeVisible();
  await page.getByRole('button', { name: '确认导出' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.stl$/);

  await page.screenshot({ path: screenshotPath(testInfo, 'workflow-desktop.png'), fullPage: true });
});

test('普通用户无法访问管理后台', async ({ page, request }) => {
  const auth = await registerOrdinaryUser(request);
  await installAuth(page, auth);
  await page.goto('/#/admin');

  await expect(page.getByText('仅管理员可访问后台页面')).toBeVisible();
});

test('伪造支付回调失败', async ({ request }) => {
  const auth = await registerUser(request, 'payment-user');
  const order = await request.post('/api/pay/create', {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    data: { plan: 'pro', amount: 100 }
  });
  expect(order.ok()).toBe(true);
  const orderBody = await order.json();

  const callback = await request.post('/api/pay/callback', {
    headers: { 'x-hicad-signature': 'forged' },
    data: { orderNo: orderBody.orderNo, amount: 100, status: 'paid' }
  });
  expect(callback.status()).toBe(401);
});

test('Playwright 截图检查桌面端布局', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const workspace = page.locator('.workspace');
  await expect(workspace).toBeVisible();
  const box = await workspace.boundingBox();
  expect(box?.width).toBeGreaterThan(1000);
  await expect(page.locator('.ai-panel')).toBeVisible();
  await expect(page.locator('.right-stack')).toBeVisible();
  await page.screenshot({ path: screenshotPath(testInfo, 'desktop-layout.png'), fullPage: true });
});

test('Playwright 截图检查移动端布局', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('summary', { hasText: 'AI 建模助手' })).toBeVisible();
  await expect(page.locator('summary', { hasText: '参数与市场' })).toBeVisible();
  const workspace = page.locator('.workspace');
  const box = await workspace.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: screenshotPath(testInfo, 'mobile-layout.png'), fullPage: true });
});

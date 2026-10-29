import { expect, type Browser, type TestInfo } from '@playwright/test';
import { devHeaders } from './helpers';

const SA_USERNAME = process.env.PW_SA_USERNAME ?? 'sa';
export const SA_PASSWORD = process.env.PW_SA_PASSWORD;

export async function newPage(browser: Browser, info: TestInfo, headers?: Record<string, string>) {
  const { viewport, hasTouch, isMobile: mobile, baseURL } = info.project.use;
  const ctx = await browser.newContext({ baseURL, viewport, hasTouch, isMobile: mobile });
  const page = await ctx.newPage();
  if (headers) await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  return page;
}

// SA thật khi có mật khẩu (SA giới hạn 10 lần/phút/IP: mỗi viewport đăng nhập đúng một lần); không thì dev admin
export async function adminPage(browser: Browser, info: TestInfo) {
  const page = await newPage(browser, info, SA_PASSWORD ? undefined : devHeaders('admin'));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  if (!SA_PASSWORD) return page;
  await page.goto('/');
  await page.getByRole('button', { name: 'Dành cho IT' }).click();
  await page.getByLabel('Tên tài khoản').fill(SA_USERNAME);
  await page.getByLabel('Mật khẩu').fill(SA_PASSWORD);
  const login = page.waitForResponse((r) => r.url().endsWith('/api/auth/sa-login'));
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await login).status()).toBe(200);
  return page;
}

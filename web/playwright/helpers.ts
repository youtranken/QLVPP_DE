import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Header dev-identity chỉ gắn cho /api: gắn toàn cục (extraHTTPHeaders) làm request font Google
// thành CORS có header lạ và bị từ chối → trang rơi về font hệ thống
export function asRole(role: 'member' | 'admin' | 'sa') {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.continue({
        headers: { ...route.request().headers(), 'x-dev-user-sub': `pw-${role}`, 'x-dev-role': role },
      }),
    );
  });
}

export const isMobile = (info: TestInfo) => info.project.name === 'mobile-390';

export async function shot(page: Page, info: TestInfo, name: string, fullPage = true) {
  // Font Google hiển thị kiểu swap: chụp trước khi tải xong sẽ ra font hệ thống
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/screens/${name}-${info.project.name}.png`, fullPage });
}

export async function expectNoContrastViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(result.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
}

export const devHeaders = (role: 'member' | 'admin' | 'sa') => ({ 'x-dev-user-sub': `pw-${role}`, 'x-dev-role': role });

// Dev-identity không tạo dòng users; người nhận xuất lẻ phải có trong danh bạ với status active
export function seedActiveUser(sub: string, fullName: string) {
  const sql = `INSERT INTO users (sub, full_name, email, status) VALUES ('${sub}', '${fullName}', '${sub}@example.test', 'active')
    ON CONFLICT (sub) DO UPDATE SET full_name = EXCLUDED.full_name, status = 'active'`;
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: fileURLToPath(new URL('../..', import.meta.url)), input: sql, stdio: ['pipe', 'ignore', 'inherit'] },
  );
}

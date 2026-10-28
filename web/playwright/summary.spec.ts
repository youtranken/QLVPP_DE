import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { asRole, expectNoContrastViolations, isMobile } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-14-shots';

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: fileURLToPath(new URL('../..', import.meta.url)), input: sql, encoding: 'utf8' },
  ).trim();
}

asRole('admin');

test.describe('E3-S2 tổng hợp', () => {
  test('E3-S2 tổng hợp: KPI x/y, lọc dòng chờ giao, nhóm phòng ban, sao chép danh sách chưa đăng ký', async ({
    page,
    request,
    context,
  }, info) => {
    const tag = `${Date.now().toString(36)}${info.project.name === 'mobile-390' ? 'm' : 'd'}`;
    const dept = `PW Phòng ${tag}`;
    const subs = { a: `pw-sum-a-${tag}`, b: `pw-sum-b-${tag}`, c: `pw-sum-c-${tag}` };
    const names = { a: `PW An ${tag}`, b: `PW Bình ${tag}`, c: `PW Chưa ĐK ${tag}` };
    psql(`INSERT INTO users (sub, full_name, email, department, status) VALUES
      ('${subs.a}', '${names.a}', '${subs.a}@example.test', '${dept}', 'active'),
      ('${subs.b}', '${names.b}', '${subs.b}@example.test', NULL, 'active'),
      ('${subs.c}', '${names.c}', '${subs.c}@example.test', '${dept}', 'active')`);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    try {
      const as = (sub: string) => ({ 'x-dev-user-sub': sub, 'x-dev-role': 'member' });
      const period = await (await request.get('/api/periods/current', { headers: as(subs.a) })).json();
      const month = Number(String(period.ym).slice(5));
      const items: { id: string; active: boolean; admin_only: boolean; name: string }[] = await (
        await request.get('/api/items', { headers: as(subs.a) })
      ).json();
      const item = items.find((i) => i.active && !i.admin_only && !i.name.startsWith('PW '))!;
      for (const [sub, qty] of [[subs.a, 3], [subs.b, 2]] as const) {
        const saved = await request.put('/api/me/request/lines', {
          headers: as(sub),
          data: { ym: period.ym, lines: [{ item_id: item.id, qty }] },
        });
        expect(saved.status()).toBe(200);
      }
      // A đã giao đủ → bộ lọc "Dòng chờ giao" chỉ còn B
      psql(`UPDATE request_lines SET delivered_qty = qty WHERE request_id IN (SELECT id FROM requests WHERE user_sub = '${subs.a}')`);

      const summaryRes = page.waitForResponse((r) => r.url().includes(`/api/admin/periods/${period.ym}/summary`));
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin\/summary$/);
      const summary = await (await summaryRes).json();
      await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
      const registered = page.getByRole('button', { name: /Phiếu đã đăng ký/ });
      await expect(registered).toContainText(`${summary.registered}/${summary.headcount}`);
      await expect(registered).toContainText(`${summary.unregistered} chưa đăng ký`);

      await page.getByRole('searchbox', { name: 'Tìm người, email…' }).fill(tag);
      const rowA = page.getByRole('row').filter({ hasText: names.a });
      const rowB = page.getByRole('row').filter({ hasText: names.b });
      await expect(rowA).toBeVisible();
      await expect(rowB).toBeVisible();
      await expect(rowA.getByRole('progressbar', { name: 'Đã giao 3/3' })).toBeVisible();
      const rows = await page.getByRole('row').allTextContents();
      const at = (s: string) => rows.findIndex((r) => r.includes(s));
      expect(at(dept)).toBeLessThan(at(names.a));
      expect(at(names.a)).toBeLessThan(at('Chưa có phòng ban'));
      expect(at('Chưa có phòng ban')).toBeLessThan(at(names.b));
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'summary');

      const pending = page.getByRole('button', { name: /Dòng chờ giao/ });
      await pending.click();
      await expect(pending).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('Đang lọc: Dòng chờ giao')).toBeVisible();
      await expect(rowA).toHaveCount(0);
      await expect(rowB).toBeVisible();
      await snap(page, info, 'filtered');

      await page.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }).click();
      const done = page.getByText(/^Đã sao chép \d+ người$/);
      await expect(done).toBeVisible();
      const text = await page.evaluate(() => navigator.clipboard.readText());
      const lines = text.split('\n');
      expect(lines[0]).toBe(`Chưa đăng ký VPP tháng ${month} (hạn 23:59 ngày 10/${String(month).padStart(2, '0')}):`);
      expect(lines).toContain(`- ${names.c} — ${dept}`);
      expect(text).not.toContain(names.a);
      await expect(done).toHaveText(`Đã sao chép ${lines.length - 1} người`);
      await snap(page, info, 'copied');
    } finally {
      psql(`DELETE FROM requests WHERE user_sub IN ('${subs.a}', '${subs.b}');
        DELETE FROM users WHERE sub IN ('${subs.a}', '${subs.b}', '${subs.c}')`);
    }
  });
});

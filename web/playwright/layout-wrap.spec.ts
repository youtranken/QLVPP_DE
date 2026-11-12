import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';
import { prevYmOf } from './locked-request';

// Chặn tái phát rà soát vòng 8 (điện thoại, màn vừa, đăng nhập): chữ trong nút không gãy dòng, các khối không bị cắt.
// Chỉ đọc: mọi request /api khác GET bị chặn trước khi tới server.

async function as(page: Page, role: 'member' | 'admin' | null) {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: role ? { ...req.headers(), ...devHeaders(role) } : req.headers() });
  });
}

async function settle(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

// Số dòng chữ của từng nút đang hiện (Range.getClientRects theo đỉnh dòng); bỏ nút cố ý nhiều dòng (khối con xếp dọc, thẻ "Không thấy món cần?")
async function wrappedButtons(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, a.btn, [role=tab], [role=radio]')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || el.closest('[aria-hidden=true], .sr-only, .rq-card-more')) continue;
      const text = (el.innerText || '').trim();
      if (text.length < 3) continue;
      const blocks = [...el.children].filter((c) => ['block', 'flex', 'grid'].includes(getComputedStyle(c).display));
      if (blocks.length >= 2) continue;
      // Nút chính màn đăng nhập được phép 2 dòng cân nhau (kiểm riêng bên dưới). Tên món/người dạng nút (…__name) là chữ dài tự nhiên.
      if (el.matches('.btn--xl, .month-switch__beyond, [class*="__name"]')) continue;
      // Chỉ chữ đang hiện: bỏ chữ trong .sr-only (nhãn ẩn của ô chọn nằm ngoài dòng, không phải gãy dòng)
      const tops = new Set<number>();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent!.trim() || node.parentElement!.closest('.sr-only, [hidden]')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width > 1) tops.add(Math.round(r.top / 4));
      }
      if (tops.size > 1) out.push(`${Math.round(box.width)}w "${text.replace(/\s+/g, ' ').slice(0, 50)}"`);
    }
    return out;
  });
}

const WIDTHS = [360, 390, 1280] as const;
const ADMIN_ROUTES = ['/admin/month', '/admin/reports', '/admin/delivery', '/admin/arrivals', '/admin/stock', '/admin/catalog', '/admin/config', '/admin/backlog'];

test.describe('Nút không gãy dòng (360/390/1280)', () => {
  for (const width of WIDTHS) {
    test(`${width}px: trang Đăng ký, đăng nhập và các trang Adm D&E`, async ({ page }, info) => {
      // Mỗi bề rộng chạy một lần (ở project khớp loại máy), tự đặt khổ
      test.skip(isMobile(info) !== width < 768, 'khổ này chạy ở project còn lại');
      await page.setViewportSize({ width, height: 800 });
      const found: string[] = [];

      await as(page, 'member');
      await settle(page, '/');
      found.push(...(await wrappedButtons(page)).map((s) => `/ ${s}`));
      await page.unrouteAll();

      await as(page, 'admin');
      for (const path of ADMIN_ROUTES) {
        await settle(page, path);
        found.push(...(await wrappedButtons(page)).map((s) => `${path} ${s}`));
      }
      expect(found).toEqual([]);
    });
  }

  test('đăng nhập: "(PMH ID)" không bị tách hai dòng ở 360/1024/1280', async ({ browser }, info) => {
    test.skip(isMobile(info), 'một lần là đủ, tự đặt khổ');
    for (const width of [360, 1024, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      await as(page, null);
      await settle(page, '/');
      const button = page.getByRole('button', { name: 'Đăng nhập bằng tài khoản công ty (PMH ID)' });
      const lines = await button.evaluate((el) => {
        const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent!.includes('PMH'))!;
        const at = node.textContent!.indexOf('(PMH');
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + '(PMH ID)'.length);
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      });
      expect(lines, `${width}px`).toBe(1);
      await page.close();
    }
  });
});

test.describe('Điện thoại và màn vừa: khối không bị cắt (vòng 8)', () => {
  test('360: thanh trên nhân viên không cắt tên app (không VI/EN, không avatar); /me có đổi ngôn ngữ', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await page.setViewportSize({ width: 360, height: 800 });
    await as(page, 'member');
    await settle(page, '/');
    const name = page.locator('.m-logo__name');
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('banner').getByRole('radiogroup')).toHaveCount(0);
    await settle(page, '/me');
    await expect(page.getByRole('main').getByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeVisible();
  });

  test('1024: thanh lọc Đăng ký — hàng trên một dòng, chip một hàng cuộn ngang, mép phải mờ khi còn chip khuất', async ({ page }, info) => {
    test.skip(isMobile(info), 'màn vừa');
    await page.setViewportSize({ width: 1024, height: 800 });
    await as(page, 'member');
    await settle(page, '/');
    const row = await page.locator('.rq-f-row').evaluate((el) => {
      const tops = new Set([...el.querySelectorAll('button, input')].filter((c) => c.getBoundingClientRect().width > 0).map((c) => Math.round(c.getBoundingClientRect().top / 8)));
      return tops.size;
    });
    expect(row).toBe(1);
    const chips = await page.locator('.rq-f-scroll').evaluate((el) => ({
      lines: new Set([...el.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top))).size,
      overflowX: getComputedStyle(el).overflowX,
      fades: el.scrollWidth > el.clientWidth ? getComputedStyle(el).maskImage !== 'none' : true,
    }));
    expect(chips).toEqual({ lines: 1, overflowX: 'auto', fades: true });
  });

  test('360/390: Báo cáo — viên chọn tháng một dòng, ghi chú kỳ mở nằm ngoài viên', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await as(page, 'admin');
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await settle(page, '/admin/reports');
      const m = await page.locator('.month-switch').first().evaluate((el) => {
        const pill = el.querySelector('.month-switch__pill')!.getBoundingClientRect();
        const note = el.querySelector('.month-switch__beyond')?.getBoundingClientRect();
        return { pillH: pill.height, noteBelow: note ? note.top >= pill.bottom - 1 : true };
      });
      expect(m.pillH, `${width}px`).toBeLessThanOrEqual(48);
      expect(m.noteBelow, `${width}px`).toBe(true);
    }
  });

  test('Kỳ tháng: viên ‹ tháng › một dòng; điện thoại chip + link xuống dưới viên; bảng năm-tháng nằm trọn màn; đổi kỳ bảng không xô', async ({ page }, info) => {
    test.skip(isMobile(info), 'tự đặt đủ 5 bề rộng, chạy một lần ở dự án máy tính');
    await as(page, 'admin');
    const open = (await (await page.request.get('/api/periods/current', { headers: devHeaders('admin') })).json()) as { ym: string };
    const locked = prevYmOf(open.ym);
    for (const width of [360, 390, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const tops: number[] = [];
      for (const ym of [locked, open.ym, locked]) {
        await settle(page, `/admin/month?ym=${ym}`);
        const m = await page.locator('.mk-switch').evaluate((el) => {
          const pill = el.querySelector('.month-switch__label')!.closest('.month-switch')!.getBoundingClientRect();
          const chip = el.querySelector('.mk-switch__status')!.getBoundingClientRect();
          const jump = el.querySelector('.mk-switch__jump')!.getBoundingClientRect();
          return { pillH: pill.height, chipBelow: chip.top >= pill.bottom - 1, jumpBelow: jump.top >= pill.bottom - 1, strip: document.querySelector('.mk-strip')!.getBoundingClientRect().top, sw: document.documentElement.scrollWidth };
        });
        expect(m.pillH, `${width}px`).toBeLessThanOrEqual(48);
        expect(m.sw, `${width}px`).toBeLessThanOrEqual(width);
        if (width < 768) expect([m.chipBelow, m.jumpBelow], `${width}px`).toEqual([true, true]);
        tops.push(m.strip);
      }
      // Dải bước (ngay trên bảng) đứng yên khi chuyển kỳ đang giao ↔ kỳ đăng ký
      expect(new Set(tops).size, `${width}px`).toBe(1);
      await page.locator('.month-switch__label').click();
      const pop = await page.getByRole('dialog', { name: 'Chọn năm-tháng' }).boundingBox();
      expect(pop!.x).toBeGreaterThanOrEqual(0);
      expect(pop!.x + pop!.width).toBeLessThanOrEqual(width);
      expect(pop!.y + pop!.height).toBeLessThanOrEqual(800);
      await page.keyboard.press('Escape');
      await expect(page.locator('.month-switch__label')).toBeFocused();
    }
  });

  test('390: hộp "Ai đăng ký" ở Báo cáo là dạng thẻ, không có cột tràn mép phải', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await as(page, 'admin');
    await settle(page, '/admin/reports');
    const people = page.getByRole('button', { name: /\d+ người/ }).first();
    test.skip((await people.count()) === 0, 'kỳ báo cáo chưa có người đăng ký');
    await people.click();
    const dialog = page.getByRole('dialog');
    const right = await dialog.evaluate((d) => Math.max(...[...d.querySelectorAll('td, th')].filter((c) => c.getBoundingClientRect().width > 0).map((c) => c.getBoundingClientRect().right)));
    expect(right).toBeLessThanOrEqual(390);
    await expect(dialog.locator('thead')).toBeHidden();
  });

  test('360: tab Giao hàng giữ đệm ≥ 12px hai bên chữ (thiếu chỗ thì cuộn ngang)', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await page.setViewportSize({ width: 360, height: 800 });
    await as(page, 'admin');
    await settle(page, '/admin/delivery');
    const pads = await page.locator('.pp-tabs .seg-m1 button').evaluateAll((buttons) =>
      buttons.map((b) => {
        const box = b.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(b);
        const rects = [...range.getClientRects()];
        return Math.min(Math.min(...rects.map((r) => r.left)) - box.left, box.right - Math.max(...rects.map((r) => r.right)));
      }),
    );
    for (const pad of pads) expect(pad).toBeGreaterThanOrEqual(11);
  });

  test('390: Nhận hàng — đầu nhóm trải hết bề ngang thẻ', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await as(page, 'admin');
    await settle(page, '/admin/arrivals');
    const head = page.locator('.ar-ghead th').first();
    test.skip((await head.count()) === 0, 'chưa có bản gửi NCC');
    const { cell, row } = await head.evaluate((th) => ({ cell: th.getBoundingClientRect().width, row: th.parentElement!.getBoundingClientRect().width }));
    expect(cell).toBeGreaterThanOrEqual(row - 1);
  });

  test('390: Sản phẩm 2 cột, không nhãn nhóm trên ảnh; mô tả trang không bị cắt', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await as(page, 'admin');
    await settle(page, '/admin/catalog');
    const cols = await page.locator('.ct-grid').first().evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(2);
    await expect(page.locator('.ct-card__group').first()).toBeHidden();
    expect(await page.locator('.page-head__desc').evaluate((p) => p.scrollHeight <= p.clientHeight + 1)).toBe(true);
  });

  test('390: Tủ/Kho — nút ⋯ cùng một chỗ (góc phải trên) ở mọi thẻ', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await as(page, 'admin');
    await settle(page, '/admin/stock');
    const spots = await page.locator('td.sk-actions').evaluateAll((cells) =>
      cells.slice(0, 8).map((td) => {
        const r = td.getBoundingClientRect();
        const tr = td.closest('tr')!.getBoundingClientRect();
        return `${Math.round(r.top - tr.top)},${Math.round(tr.right - r.right)}`;
      }),
    );
    expect(new Set(spots).size).toBe(1);
  });

  test('360×640: menu Adm D&E — chân menu gọn, thấy ≥ 8 mục điều hướng', async ({ page }, info) => {
    test.skip(!isMobile(info), 'điện thoại');
    await page.setViewportSize({ width: 360, height: 640 });
    await as(page, 'admin');
    await settle(page, '/admin/month');
    await page.getByRole('button', { name: /menu/i }).first().click();
    const sheet = page.locator('.side-sheet');
    await expect(sheet).toBeVisible();
    const seen = await sheet.evaluate((s) => {
      const nav = s.querySelector('.side__nav')!.getBoundingClientRect();
      return [...s.querySelectorAll('.side__nav a')].filter((a) => a.getBoundingClientRect().bottom <= nav.bottom + 1).length;
    });
    expect(seen).toBeGreaterThanOrEqual(8);
  });

  test('1280: Cấu hình — ô ký không cắt chữ, ô nhập cùng hàng thẳng nhau', async ({ page }, info) => {
    test.skip(isMobile(info), 'máy tính');
    await as(page, 'admin');
    await settle(page, '/admin/config');
    const inputs = await page.locator('.cf-box').first().locator('input').evaluateAll((list) =>
      list.map((i) => ({ clipped: (i as HTMLInputElement).scrollWidth > (i as HTMLInputElement).clientWidth + 1, top: Math.round(i.getBoundingClientRect().top), left: Math.round(i.getBoundingClientRect().left) })),
    );
    expect(inputs.filter((i) => i.clipped)).toEqual([]);
    // Cùng hàng (3 cột) thì cùng đỉnh; xếp một cột thì cùng mép trái
    const sameTop = new Set(inputs.map((i) => i.top)).size === 1;
    const sameLeft = new Set(inputs.map((i) => i.left)).size === 1;
    expect(sameTop || sameLeft).toBe(true);
  });
});

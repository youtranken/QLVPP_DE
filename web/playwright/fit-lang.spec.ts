import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// Chữ tiếng Anh dài hơn tiếng Việt: đo cả hai ngôn ngữ ở bề rộng desktop. Chỉ đọc.
const LANGS = ['vi', 'en'] as const;

async function as(page: Page, lang: 'vi' | 'en') {
  await skipNewPeriodPopup(page);
  await page.addInitScript((l) => localStorage.setItem('vpp_lang', l), lang);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders('admin') } });
  });
}

async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

// Mọi phần tử con của ô (kể cả nhãn .tag) nằm trong mép phải ô
function cellOverflow(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const td of document.querySelectorAll<HTMLElement>('main tbody td')) {
      const c = td.getBoundingClientRect();
      if (c.width === 0 || getComputedStyle(td.closest('tr')!).display !== 'table-row') continue;
      for (const el of td.querySelectorAll<HTMLElement>('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > c.right + 1 && getComputedStyle(el).position !== 'absolute') {
          out.push(`"${(el.textContent ?? '').trim().slice(0, 30)}" ra ${Math.round(r.right - c.right)}px`);
          break;
        }
      }
    }
    return [...new Set(out)].slice(0, 6);
  });
}

test.describe('Vừa ô, vi + en', () => {
  for (const lang of LANGS) {
    for (const width of [768, 1024, 1280]) {
      test(`${lang} ${width}: nhãn trong ô Kỳ tháng, Danh bạ, Giao hàng không ra ngoài ô`, async ({ page }, info) => {
        test.skip(isMobile(info), 'đo ở desktop');
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 900 });
        await as(page, lang);
        for (const path of ['/admin/month', '/admin/users', '/admin/delivery']) {
          await go(page, path);
          expect.soft(await cellOverflow(page), `${path} ${lang} @${width}`).toEqual([]);
        }
      });
    }
  }

  for (const lang of LANGS) {
    test(`${lang} 1280: nhãn trong bảng Kỳ tháng và Danh bạ đủ chỗ một dòng`, async ({ page }, info) => {
      test.skip(isMobile(info), 'đo ở 1280');
      await page.setViewportSize({ width: 1280, height: 900 });
      await as(page, lang);
      for (const path of ['/admin/month', '/admin/users']) {
        await go(page, path);
        const tall = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('main tbody td .tag')].filter((t) => t.getBoundingClientRect().height > 24).map((t) => t.textContent?.trim()),
        );
        expect.soft([...new Set(tall)], `${path} ${lang}`).toEqual([]);
      }
    });
  }

  for (const lang of LANGS) {
    test(`${lang} 1280: Danh bạ — mã NV thật không bị cắt, tiêu đề Mã NV một dòng; 1024 không cuộn ngang`, async ({ page }, info) => {
      test.skip(isMobile(info), 'đo ở desktop');
      await as(page, lang);
      await page.setViewportSize({ width: 1280, height: 900 });
      await go(page, '/admin/users');
      const m = await page.evaluate(() => {
        const codes = [...document.querySelectorAll<HTMLElement>('main tbody td:nth-child(2) .cell-clip')].filter((c) => !/^(e2e|pw)-/.test(c.textContent ?? ''));
        const lines = (el: Element) => {
          const rg = document.createRange();
          rg.selectNodeContents(el);
          return new Set([...rg.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top))).size;
        };
        return {
          n: codes.length,
          cut: codes.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => `${c.textContent} ${c.scrollWidth}>${c.clientWidth}`),
          wrapped: [...document.querySelectorAll('main thead th:nth-child(2)')].filter((th) => lines(th) > 1).map((th) => th.textContent?.trim()),
        };
      });
      expect(m.n, 'có mã NV để đo').toBeGreaterThan(0);
      expect.soft(m.cut, 'mã NV bị cắt').toEqual([]);
      expect.soft(m.wrapped, 'tiêu đề xuống dòng').toEqual([]);
      await page.setViewportSize({ width: 1024, height: 900 });
      await go(page, '/admin/users');
      const scroll = await page.evaluate(() => {
        const t = document.querySelector('main table')!;
        return { table: Math.round(t.getBoundingClientRect().width), wrap: Math.round(t.parentElement!.getBoundingClientRect().width), page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect.soft(scroll.table, 'bảng 1024 vừa khung').toBeLessThanOrEqual(scroll.wrap);
      expect.soft(scroll.page, 'trang 1024 không cuộn ngang').toBeLessThanOrEqual(0);
    });
  }

  // Thẻ số: dòng phụ tối đa 2 dòng không bị cắt, nhãn không cắt, số các thẻ cùng hàng lệch ≤ 2px
  function statCards(page: Page) {
    return page.evaluate(() => {
      const cut: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('main .stat-card__sub, main .stat-card__k')) {
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) cut.push(`${(el.textContent ?? '').trim().slice(0, 40)} ${el.scrollWidth}x${el.scrollHeight}>${el.clientWidth}x${el.clientHeight}`);
      }
      const rows = new Map<number, number[]>();
      for (const card of document.querySelectorAll<HTMLElement>('main .stat-card')) {
        const v = card.querySelector('.stat-card__v');
        if (!v) continue;
        const top = Math.round(card.getBoundingClientRect().top);
        rows.set(top, [...(rows.get(top) ?? []), v.getBoundingClientRect().top]);
      }
      const skew = Math.max(0, ...[...rows.values()].map((tops) => Math.max(...tops) - Math.min(...tops)));
      return { cut, skew: Math.round(skew), cards: document.querySelectorAll('main .stat-card').length };
    });
  }

  for (const lang of LANGS) {
    for (const width of [390, 768, 1024, 1280]) {
      test(`${lang} ${width}: thẻ số Hôm nay, Giao hàng — chữ không bị cắt, số cùng hàng thẳng nhau`, async ({ page }, info) => {
        test.skip(isMobile(info), 'đặt bề rộng trong test');
        await page.setViewportSize({ width, height: 900 });
        await as(page, lang);
        for (const path of ['/admin/today', '/admin/delivery']) {
          await go(page, path);
          const m = await statCards(page);
          expect(m.cards, `${path} có thẻ số`).toBeGreaterThan(0);
          expect.soft(m.cut, `${path} ${lang} @${width} chữ bị cắt`).toEqual([]);
          expect.soft(m.skew, `${path} ${lang} @${width} số lệch`).toBeLessThanOrEqual(2);
        }
      });
    }
  }
});

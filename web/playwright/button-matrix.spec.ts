import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { asRole, settled } from './helpers';

// Ma trận biến thể nút x 5 trạng thái x nền đặt nút, đo getComputedStyle
// (nền trộn alpha với tổ tiên thật). Fixture tự dựng trong trang, không đụng dữ liệu dev.
asRole('admin');

const VARIANTS = {
  base: 'btn',
  primary: 'btn btn--primary',
  ghost: 'btn btn--ghost',
  danger: 'btn btn--danger',
  'quiet-danger': 'btn btn--quiet-danger',
  'danger-ghost': 'btn btn--danger-ghost',
  'danger-solid': 'btn btn--danger btn--solid',
  dark: 'btn btn--dark',
  'hm-dark': 'btn hm-btn-dark',
  'hm-cta': 'btn hm-cta',
} as const;
type Variant = keyof typeof VARIANTS;
const STATES = ['default', 'hover', 'focus', 'active', 'disabled'] as const;
type State = (typeof STATES)[number];
// Nền đặt nút: panel sáng, thẻ trắng, dải tối hm-hero, hộp thoại, panel phủ kính
const SURFACES = {
  panel: 'background: var(--c-surface-2)',
  card: 'background: var(--c-surface)',
  hero: 'background: var(--c-dark)',
  dialog: 'background: var(--c-surface); box-shadow: 0 8px 24px rgb(0 0 0 / .2)',
  glass: 'background: rgb(255 255 255 / .55)',
} as const;
type Surface = keyof typeof SURFACES;

const TEXT_MIN = 4.5;
const BORDER_MIN = 3;
const DISABLED_MIN = 3;
const CHANGE_MIN = 1.15;
// Tổ hợp được khai báo: nút hm-cta/hm-dark chỉ ở dải tối; nút ghost (trong suốt, chữ tối) không đặt trên dải tối
// (dải hm-hero chỉ có hm-cta và Segmented); còn lại mọi nền
const DARK_ONLY: Variant[] = ['hm-cta', 'hm-dark'];
const LIGHT_ONLY: Variant[] = ['ghost'];
const placed = (v: Variant, s: Surface) => (DARK_ONLY.includes(v) ? s === 'hero' : !(LIGHT_ONLY.includes(v) && s === 'hero'));
const combos = (): [Variant, Surface][] =>
  (Object.keys(VARIANTS) as Variant[]).flatMap((v) => (Object.keys(SURFACES) as Surface[]).filter((s) => placed(v, s)).map((s): [Variant, Surface] => [v, s]));

type Measure = { bg: string; fg: string; border: string; surface: string; surfaceBg: string };

async function mount(page: Page) {
  await page.goto('/admin/month');
  await settled(page);
  await page.evaluate(
    ({ variants, surfaces }) => {
      const host = document.createElement('div');
      host.id = 'pw-btn-matrix';
      // Đo trạng thái cuối: nút có transition nền, getComputedStyle ngay sau khi ép trạng thái còn trả màu cũ
      const still = document.createElement('style');
      still.textContent = '#pw-btn-matrix * { transition: none !important; }';
      host.appendChild(still);
      host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#d7eaef;display:grid;gap:8px;padding:8px;align-content:start';
      const shell = document.querySelector("[data-shell='admin']") ?? document.body;
      shell.appendChild(host);
      for (const [sname, css] of Object.entries(surfaces)) {
        const row = document.createElement('div');
        row.dataset.surface = sname;
        row.style.cssText = `${css}; display:flex; flex-wrap:wrap; gap:8px; padding:12px; border-radius:12px`;
        for (const [vname, cls] of Object.entries(variants)) {
          for (const st of ['default', 'hover', 'focus', 'active', 'disabled']) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = cls;
            b.textContent = 'Nút';
            b.dataset.v = vname;
            b.dataset.s = st;
            if (st === 'disabled') b.disabled = true;
            row.appendChild(b);
          }
        }
        host.appendChild(row);
      }
    },
    { variants: VARIANTS, surfaces: SURFACES },
  );
}

async function force(cdp: CDPSession, rootId: number, v: Variant, s: Surface, state: State) {
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: rootId, selector: `[data-surface='${s}'] [data-v='${v}'][data-s='${state}']` });
  const forced = state === 'hover' ? ['hover'] : state === 'active' ? ['hover', 'active'] : state === 'focus' ? ['focus', 'focus-visible'] : [];
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced });
}

// Đo trong trang: nền trộn alpha với tổ tiên thật; viền = inset box-shadow 1px (nếu có) trộn lên nền nút
const MEASURE = ({ v, s, st }: { v: string; s: string; st: string }): Measure => {
  const el = document.querySelector(`[data-surface='${s}'] [data-v='${v}'][data-s='${st}']`) as HTMLElement;
  type RGBA = [number, number, number, number];
  const parse = (c: string): RGBA => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = (m[1] ?? '').split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
  };
  const over = (top: RGBA, under: RGBA): RGBA => {
    const a = top[3] + under[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => ((top[i] ?? 0) * top[3] + (under[i] ?? 0) * under[3] * (1 - top[3])) / a).concat(a) as RGBA;
  };
  const backdrop = (node: HTMLElement | null): RGBA => {
    const chain: RGBA[] = [];
    for (let n = node; n; n = n.parentElement) chain.push(parse(getComputedStyle(n).backgroundColor));
    return chain.reduceRight<RGBA>((acc, c) => over(c, acc), [255, 255, 255, 1]);
  };
  const css = getComputedStyle(el);
  const under = backdrop(el.parentElement);
  const bg = over(parse(css.backgroundColor), under);
  const ring = css.boxShadow.match(/(rgba?\([^)]+\))\s+0px 0px 0px 1px inset/)?.[1];
  const border = ring ? over(parse(ring), bg) : bg;
  const fmt = (c: RGBA) => `rgb(${c.slice(0, 3).map((x) => Math.round(x)).join(', ')})`;
  return { bg: fmt(bg), fg: css.color, border: fmt(border), surface: s, surfaceBg: fmt(under) };
};

const lum = (rgb: string) => {
  const [r = 0, g = 0, b = 0] = (rgb.match(/\d+/g) ?? []).map((x) => {
    const c = Number(x) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

async function measureAll(page: Page) {
  await mount(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const out = new Map<string, Measure>();
  for (const [v, s] of combos()) {
    for (const st of STATES) {
      await force(cdp, root.nodeId, v, s, st);
      out.set(`${v}|${s}|${st}`, await page.evaluate(MEASURE, { v, s, st }));
    }
  }
  return out;
}

test.describe('Ma trận nút admin (R-D4)', () => {
  test('mọi biến thể x 5 trạng thái x nền: chữ >= 4.5, viền/nền >= 3, nền đổi >= 1.15 khi hover/nhấn, giữ sắc', async ({ page }) => {
    const m = await measureAll(page);
    const fails: string[] = [];
    for (const [v, s] of combos()) {
      const at = (st: State) => m.get(`${v}|${s}|${st}`) as Measure;
      for (const st of STATES) {
        const x = at(st);
        const disabled = st === 'disabled';
        if (!disabled && ratio(x.fg, x.bg) < TEXT_MIN) fails.push(`${v} x ${st} x ${s}: chữ ${ratio(x.fg, x.bg).toFixed(2)} < ${TEXT_MIN}`);
        if (disabled && ratio(x.fg, x.bg) < DISABLED_MIN) fails.push(`${v} x disabled x ${s}: chữ ${ratio(x.fg, x.bg).toFixed(2)} < ${DISABLED_MIN}`);
        // Biên nút nhìn thấy được: viền hoặc nền so với nền đặt nút
        if (!disabled) {
          const edge = Math.max(ratio(x.border, x.surfaceBg), ratio(x.bg, x.surfaceBg));
          if (v !== 'ghost' && v !== 'danger-ghost' && edge < BORDER_MIN && ratio(x.fg, x.bg) < TEXT_MIN) fails.push(`${v} x ${st} x ${s}: biên ${edge.toFixed(2)} < ${BORDER_MIN}`);
        }
      }
      const d = at('default');
      for (const st of ['hover', 'active'] as const) {
        const x = at(st);
        if (v !== 'ghost' && ratio(x.bg, d.bg) < CHANGE_MIN && x.border === d.border) fails.push(`${v} x ${st} x ${s}: nền đổi ${ratio(x.bg, d.bg).toFixed(2)} < ${CHANGE_MIN}`);
      }
      // Giữ sắc: nền mặc định khác nền trắng thì hover/active không rơi về nền hover/2 của nút trắng
      const white = 'rgb(255, 255, 255)';
      if (d.bg !== white && v !== 'ghost' && v !== 'danger-ghost' && s !== 'glass') {
        const surfHover = 'rgb(242, 248, 250)';
        const surf2 = 'rgb(238, 245, 247)';
        if (at('hover').bg === surfHover) fails.push(`${v} x hover x ${s}: rơi về --c-surface-hover`);
        if (at('active').bg === surf2) fails.push(`${v} x active x ${s}: rơi về --c-surface-2`);
      }
      // Biến thể nền tối: nhấn tối hơn hover
      if (['danger-solid', 'dark', 'hm-dark'].includes(v) && lum(at('active').bg) >= lum(at('hover').bg)) fails.push(`${v} x active x ${s}: nhấn không tối hơn hover`);
    }
    expect(fails, fails.join('\n')).toEqual([]);
  });

  test('.hm-cta trên dải tối: hover = rgb(196, 238, 246), active = rgb(138, 214, 229), không về #F2F8FA', async ({ page }) => {
    const m = await measureAll(page);
    const at = (st: State) => m.get(`hm-cta|hero|${st}`) as Measure;
    expect(at('default').bg).toBe('rgb(159, 227, 240)');
    expect(at('hover').bg).toBe('rgb(196, 238, 246)');
    expect(at('active').bg).toBe('rgb(138, 214, 229)');
    expect(at('hover').bg).not.toBe('rgb(242, 248, 250)');
  });

  test('R-D4.6: tổ hợp lạ trong fixture làm ma trận báo lỗi', async ({ page }) => {
    await mount(page);
    // Lớp btn--lạ không có biến thể khai báo: nền hover rơi về nền trắng của nút gốc -> ma trận phải bắt được
    const rogue = await page.evaluate(() => {
      const b = document.createElement('button');
      b.className = 'btn btn--lạ';
      b.style.setProperty('--btn-bg', 'rgb(14, 106, 123)');
      document.querySelector('#pw-btn-matrix')?.appendChild(b);
      const cs = getComputedStyle(b);
      return { bg: cs.backgroundColor, hasHover: cs.getPropertyValue('--btn-bg-hover').trim() };
    });
    expect(rogue.hasHover, 'biến thể có --btn-bg mà thiếu --btn-bg-hover').toBe('');
  });

  test('ảnh chuẩn: ma trận nút trên fixture tự dựng (R-D9.2, maxDiffPixelRatio 0.01)', async ({ page }) => {
    await mount(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('#pw-btn-matrix')).toHaveScreenshot('button-matrix.png', { maxDiffPixelRatio: 0.01 });
  });
});

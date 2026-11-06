import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PW_DIR = resolve(__dirname, '../../playwright');
const API_TEST_DIR = resolve(__dirname, '../../../api/test');

const SEEDERS = ['seedPwItem', 'seedActiveUser'];
const WRITE_CALL =
  /\brequest\.(?:post|put|patch|delete)\(\s*[`'"][^`'"]*(?:\/stock\/receipts|\/deliver|\/lines|\/adm-out|\/snapshots|\/cancel-remaining)/;
// Mã món dev dạng chữ + 2 số (B23, K05); mã test/story (E9-S2, V2D-1) không khớp
const DEV_ITEM_CODE = /\b[A-Z]\d{2}\b/;
const REAL_ITEM_PICK = /!\s*\w+\.name\.startsWith\(\s*['"`]PW /;
const ADJUSTMENT_WRITE = /\binsert\s+into\s+request_line_adjustments\b/i;
const TEST_START = /\n(?=[ \t]*test(?:\.\w+)?\(\s*['"`])/;

type Source = { file: string; text: string };

const read = (dir: string, keep: (f: string) => boolean): Source[] =>
  readdirSync(dir)
    .filter(keep)
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }));

const callPattern = (name: string) => new RegExp(`\\b${name}\\(`);

function functionBodies(sources: string[]): Map<string, string> {
  const bodies = new Map<string, string>();
  const decl = /^([ \t]*)(?:export\s+)?(?:(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\()/gm;
  for (const src of sources) {
    for (const m of src.matchAll(decl)) {
      const head = src.indexOf('\n', m.index);
      // Thân kết thúc ở dòng kế tiếp có cùng thụt lề (dấu đóng khối hoặc câu lệnh sau)
      const next = new RegExp(`\\n${m[1]}(?=\\S)`, 'g');
      next.lastIndex = head === -1 ? src.length : head;
      const end = next.exec(src)?.index ?? src.length;
      bodies.set(m[2] ?? m[3], src.slice(src.indexOf('(', m.index), end));
    }
  }
  return bodies;
}

// Hàm mà thân khớp mẫu hoặc gọi tới một hàm đã thuộc tập → gọi hàm đó cũng là làm việc ấy
function closureOf(bodies: Map<string, string>, start: Iterable<string>, direct?: RegExp): Set<string> {
  const found = new Set(start);
  for (const [name, body] of bodies) if (direct?.test(body)) found.add(name);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [name, body] of bodies) {
      if (found.has(name)) continue;
      if ([...found].some((s) => callPattern(s).test(body))) {
        found.add(name);
        grew = true;
      }
    }
  }
  return found;
}

const seedingFunctions = (sources: string[]) => closureOf(functionBodies(sources), SEEDERS);

// Bản chốt ở kỳ trước thật làm kỳ dev của chủ hiện "đã gửi" với bản PW → chỉ ghi vào kỳ riêng PRIVATE_YM
const SNAPSHOT_WRITE = /INSERT INTO report_snapshots|request\.post\([^)]*\/snapshots`/;
// Hàm cấp tệp nằm sau test cuối của một khối không thuộc test đó
const TOP_LEVEL_DECL = /\n(?=(?:export\s+)?(?:async\s+)?function\s|const\s)/;

function realPeriodSnapshotWrites(spec: string, writers: Set<string>): string[] {
  const calls = [...writers].map(callPattern);
  return spec
    .split(TEST_START)
    .slice(1)
    .map((block) => block.split(TOP_LEVEL_DECL)[0])
    .filter((block) => SNAPSHOT_WRITE.test(block) || calls.some((c) => c.test(block)))
    .filter((block) => !(block.includes('PRIVATE_YM') && block.includes('clearPrivateSnapshots()')))
    .map((block) => block.trim().split('\n')[0]);
}

function unseededWrites(spec: string, seeders: Set<string>): string[] {
  const calls = [...seeders].map(callPattern);
  return spec
    .split(TEST_START)
    .slice(1)
    .filter((block) => WRITE_CALL.test(block) && !calls.some((c) => c.test(block)))
    .map((block) => block.trim().split('\n')[0]);
}

describe('chính sách dữ liệu Playwright: chỉ ghi lên dữ liệu PW tự gieo', () => {
  const helpers = read(PW_DIR, (f) => f.endsWith('.ts'));
  const specs = helpers.filter((s) => s.file.endsWith('.spec.ts'));
  const seeders = seedingFunctions(helpers.map((s) => s.text));
  const snapshotWriters = closureOf(functionBodies(helpers.map((s) => s.text)), [], SNAPSHOT_WRITE);

  it('bộ quét bắt được test ghi mà không gieo, và chấp nhận test có gieo qua hàm trung gian', () => {
    const bad = `test('a', async ({ request }) => {\n  await request.post('/api/admin/lines/x/deliver', {});\n});\n`;
    const viaHelper = `function seedX() {\n  seedActiveUser('pw-a', 'PW A');\n}\ntest('b', async ({ request }) => {\n  seedX();\n  await request.put('/api/me/request/lines', {});\n});\n`;
    expect(unseededWrites(`\n${bad}`, seedingFunctions([bad]))).toHaveLength(1);
    expect(unseededWrites(`\n${viaHelper}`, seedingFunctions([viaHelper]))).toEqual([]);
    expect(DEV_ITEM_CODE.test("const code = 'B23';")).toBe(true);
    expect(DEV_ITEM_CODE.test("test('E9-S2 V2D-1 A4')")).toBe(false);
  });

  it('có helper seedPwItem/seedActiveUser trong helpers.ts', () => {
    const h = helpers.find((s) => s.file === 'helpers.ts')?.text ?? '';
    expect(h).toMatch(/export async function seedPwItem\(/);
    expect(h).toMatch(/export function seedActiveUser\(/);
  });

  it.each(specs.map((s) => [s.file, s]))('%s: mọi lời gọi ghi nằm trong test có gieo món/người PW', (_f, s) => {
    expect(unseededWrites(s.text, seeders)).toEqual([]);
  });

  it('bộ quét bản chốt bắt được ghi qua hàm trung gian ở kỳ thật, chấp nhận kỳ riêng có dọn', () => {
    const helper = `function insertSnap(ym) {\n  return psql(\`INSERT INTO report_snapshots (period_ym) VALUES ('\${ym}-01')\`);\n}\n`;
    const real = `\ntest('a', async () => {\n  insertSnap(seed.prevYm);\n});\n${helper}`;
    const priv = `\ntest('b', async () => {\n  insertSnap(PRIVATE_YM);\n  clearPrivateSnapshots();\n});\n`;
    const writers = closureOf(functionBodies([helper]), [], SNAPSHOT_WRITE);
    expect(realPeriodSnapshotWrites(real, writers)).toEqual(["test('a', async () => {"]);
    expect(realPeriodSnapshotWrites(priv, writers)).toEqual([]);
  });

  it.each(specs.map((s) => [s.file, s]))(
    '%s: test ghi bản chốt chỉ ghi vào kỳ riêng PRIVATE_YM và dọn bằng clearPrivateSnapshots',
    (_f, s) => {
      expect(realPeriodSnapshotWrites(s.text, snapshotWriters)).toEqual([]);
    },
  );

  // Bảng điều chỉnh là chỉ-thêm (trigger chặn UPDATE/DELETE): dòng PW ghi vào sẽ không bao giờ dọn được → giả ở trình duyệt
  it('không spec/helper nào ghi thẳng vào request_line_adjustments', () => {
    const offenders = helpers.flatMap((s) =>
      s.text.split('\n').flatMap((line, i) => (ADJUSTMENT_WRITE.test(line) ? [`${s.file}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(ADJUSTMENT_WRITE.test("psql(`INSERT INTO request_line_adjustments (batch_id) VALUES (gen_random_uuid())`)")).toBe(true);
    expect(ADJUSTMENT_WRITE.test("      insert   into request_line_adjustments(")).toBe(true);
    expect(offenders).toEqual([]);
  });

  it('web/playwright không có mã món dev, không dùng demo-d10, không lọc món thật', () => {
    const offenders = helpers.flatMap((s) =>
      s.text.split('\n').flatMap((line, i) => {
        const hit = DEV_ITEM_CODE.test(line) || line.includes('demo-d10') || REAL_ITEM_PICK.test(line);
        return hit ? [`${s.file}:${i + 1}: ${line.trim()}`] : [];
      }),
    );
    expect(offenders).toEqual([]);
  });

  it('api/test không dùng dữ liệu demo kỳ 10 của dev', () => {
    const offenders = read(API_TEST_DIR, (f) => f.endsWith('.ts'))
      .filter((s) => s.text.includes('demo-d10'))
      .map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});

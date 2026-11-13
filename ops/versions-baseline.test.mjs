// B6: docs/versions-baseline.md là nguồn ghi phiên bản đã chốt (định dạng chung với PMH ID/QLTS/QLHS).
// Test bắt lệch giữa bảng và repo: đổi bản ở một chỗ mà quên bảng (hay ngược lại) là đỏ.
// Không phụ thuộc gói nào; cần đã `npm ci` trong api/ và web/ (so với bản ĐÃ CÀI).
//   node --test ops/versions-baseline.test.mjs   (hoặc `npm run test:versions` trong api/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'docs/versions-baseline.md');

/** Các dòng bảng "| Thành phần | Bản ghim | Nơi ghim |". */
export function parseBaseline(md) {
  const lines = md.split('\n').filter((l) => /^\s*\|/.test(l));
  const head = lines.findIndex((l) => /Thành phần\s*\|\s*Bản ghim\s*\|\s*Nơi ghim/.test(l));
  if (head < 0) throw new Error('thiếu dòng tiêu đề bảng "Thành phần | Bản ghim | Nơi ghim"');
  return lines.slice(head + 2).map((l) => {
    const c = l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim().replace(/^`|`$/g, ''));
    return { ten: c[0], ban: c[1], noi: (c[2] ?? '').split(',').map((x) => x.trim()).filter(Boolean) };
  });
}

/** Mọi tham chiếu image ở dòng FROM / image: (bỏ tên tầng nội bộ `FROM builder`). */
export function imageRefs(text) {
  const stages = new Set([...text.matchAll(/^\s*FROM\s+\S+\s+AS\s+(\S+)/gim)].map((m) => m[1].toLowerCase()));
  const out = [];
  for (const [i, l] of text.split('\n').entries()) {
    const m = /^\s*(?:FROM\s+(?:--\S+\s+)*(\S+)|image:\s*['"]?([^'"\s#]+))/i.exec(l);
    const ref = m && (m[1] ?? m[2]);
    if (!ref || stages.has(ref.toLowerCase())) continue;
    out.push({ line: i + 1, ref });
  }
  return out;
}

/** Image tự build trong repo (compose `image: vpp-api:latest` đi kèm `build:`) — không kéo từ registry. */
const isLocalImage = (ref) => /^vpp-[\w-]+(:|$)/.test(ref);

/** Tag trôi: không tag, `latest`, hay tag thiếu số vá (`18-alpine`, `24`, `1.30-alpine`). PostgreSQL chỉ có x.y. */
export function isFloating(ref) {
  if (ref.includes('@sha256:')) return false;
  const name = ref.split('/').pop();
  const i = name.lastIndexOf(':');
  if (i < 0) return true;
  const repo = name.slice(0, i);
  const tag = name.slice(i + 1);
  const re = repo === 'postgres' ? /^\d+\.\d+(\.\d+)?(-[a-z0-9.]+)?$/ : /^v?\d+\.\d+\.\d+(-[a-z0-9.]+)?$/;
  return !re.test(tag);
}

const rows = () => parseBaseline(readFileSync(BASELINE, 'utf8'));
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

function composeAndDockerfiles(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'data-backups', 'design-preview'].includes(f) || f.startsWith('.')) continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) composeAndDockerfiles(p, out);
    else if (/^Dockerfile|^docker-compose.*\.ya?ml$/.test(f)) out.push(p);
  }
  return out;
}

/** Bản đã cài của gói, đọc từ node_modules của chính package đó (npm hoist về gốc từng package). */
function installedVersion(pkgJsonFile, name) {
  const req = createRequire(path.join(ROOT, pkgJsonFile));
  let file;
  try {
    file = req.resolve(`${name}/package.json`);
  } catch {
    // gói chặn "./package.json" trong exports → đọc thẳng thư mục
    file = path.join(ROOT, path.dirname(pkgJsonFile), 'node_modules', name, 'package.json');
  }
  assert.ok(existsSync(file), `${pkgJsonFile}: chưa cài ${name} (chạy npm ci)`);
  return JSON.parse(readFileSync(file, 'utf8')).version;
}

test('có docs/versions-baseline.md với bảng đúng định dạng', () => {
  assert.ok(existsSync(BASELINE), 'thiếu docs/versions-baseline.md');
  const r = rows();
  assert.ok(r.length >= 10, `chỉ ${r.length} dòng`);
  for (const x of r) {
    assert.ok(x.ten && x.ban, JSON.stringify(x));
    assert.ok(x.noi.length >= 1, `${x.ten}: thiếu Nơi ghim`);
    // bản chính xác: x.y.z (PostgreSQL chỉ có x.y), không ^range, không tag trôi
    assert.match(x.ban, /^v?\d+\.\d+(\.\d+)?(-[a-z0-9.]+)?$/, `${x.ten}: "${x.ban}" phải là bản chính xác`);
    for (const f of x.noi) assert.ok(existsSync(path.join(ROOT, f)), `${x.ten}: không thấy ${f}`);
  }
});

test('không dòng trùng tên', () => {
  const seen = new Set();
  for (const { ten } of rows()) {
    assert.ok(!seen.has(ten), `trùng ${ten}`);
    seen.add(ten);
  }
});

test('mỗi dòng: mọi file trong Nơi ghim mang đúng bản ghim', () => {
  for (const { ten, ban, noi } of rows()) {
    for (const f of noi) {
      const t = read(f);
      if (ten.endsWith('-image')) {
        const img = ten.slice(0, -'-image'.length);
        const refs = imageRefs(t)
          .map((x) => x.ref)
          .filter((r) => new RegExp(`^(?:\\S*/)?${esc(img)}:`).test(r))
          .map((r) => r.slice(r.lastIndexOf(':') + 1));
        assert.ok(refs.length >= 1, `${f}: không có image ${img}`);
        for (const tag of refs) assert.equal(tag, ban, `${f}: ${img}:${tag}`);
      } else if (ten === 'nvmrc') {
        assert.equal(t.trim(), ban, f);
      } else {
        const pkg = JSON.parse(t);
        const khai = { ...pkg.dependencies, ...pkg.devDependencies }[ten];
        assert.ok(khai, `${f}: không khai báo ${ten}`);
        // So với bản ĐÃ CÀI (range ^/~ có thể trôi), không so chuỗi khai báo.
        const cai = installedVersion(f, ten);
        assert.equal(cai, ban, `${f}: ${ten} đang cài ${cai}`);
      }
    }
  }
});

test('Node trong Dockerfile khớp .nvmrc và engines của api/web cho phép bản đó', () => {
  const nvm = read('.nvmrc').trim();
  const img = rows().find((r) => r.ten === 'node-image');
  assert.ok(img, 'thiếu dòng node-image');
  assert.equal(img.ban.replace(/-.*$/, ''), nvm, '.nvmrc lệch node-image');
  const major = Number(nvm.split('.')[0]);
  for (const f of ['api/package.json', 'web/package.json']) {
    const eng = JSON.parse(read(f)).engines?.node ?? '';
    const m = /^>=\s*(\d+)/.exec(eng);
    assert.ok(m && Number(m[1]) <= major, `${f}: engines.node "${eng}" không nhận Node ${major}`);
  }
});

test('không image nào trong Dockerfile/compose dùng tag trôi, và mọi image đều có dòng -image trong bảng', () => {
  const imgs = new Set(rows().filter((r) => r.ten.endsWith('-image')).map((r) => `${r.ten.slice(0, -6)}:${r.ban}`));
  const files = composeAndDockerfiles(ROOT);
  assert.ok(files.length >= 4, `chỉ thấy ${files.length} Dockerfile/compose`);
  for (const f of files) {
    for (const { line, ref } of imageRefs(readFileSync(f, 'utf8'))) {
      if (isLocalImage(ref)) continue;
      const where = `${path.relative(ROOT, f)}:${line} ${ref}`;
      assert.ok(!isFloating(ref), `${where}: tag trôi — ghi số cụ thể`);
      assert.ok(imgs.has(ref.split('/').pop()), `${where}: chưa có trong bảng`);
    }
  }
});

test('isFloating: bắt tag trôi, nhận bản cụ thể', () => {
  for (const r of ['node', 'node:latest', 'node:24-alpine', 'nginx:1.30-alpine', 'postgres:18-alpine', 'postgres:18', 'library/redis:8'])
    assert.ok(isFloating(r), r);
  for (const r of ['node:26.13.1-alpine', 'nginx:1.30.6-alpine', 'postgres:18.6-alpine', 'docker.io/library/node:26.13.1', 'node@sha256:abc'])
    assert.ok(!isFloating(r), r);
});

test('imageRefs: bỏ tầng nội bộ, đọc cả image: có nháy', () => {
  const refs = imageRefs('FROM node:1.2.3 AS builder\nFROM builder\nFROM --platform=linux/amd64 nginx:1.30.6\n  image: "postgres:18.6-alpine"\n');
  assert.deepEqual(refs.map((x) => x.ref), ['node:1.2.3', 'nginx:1.30.6', 'postgres:18.6-alpine']);
});

test('parseBaseline: bảng thiếu tiêu đề thì báo lỗi rõ', () => {
  assert.throws(() => parseBaseline('| a | b |\n| - | - |'), /thiếu dòng tiêu đề/);
});

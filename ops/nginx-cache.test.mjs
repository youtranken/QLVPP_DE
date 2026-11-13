// L1 (rà soát 13/11): web/nginx.conf phải đặt cache đúng — index.html no-cache, chunk /static có hash cache
// 1 năm, tệp tĩnh thiếu → 404 (không rơi về index.html, không mang max-age), chỉ route SPA mới về index.html.
// Đọc tĩnh, không cần nginx/docker.   node --test ops/nginx-cache.test.mjs   (hoặc `npm run test:nginx` trong web/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const conf = readFileSync(path.join(WEB, 'nginx.conf'), 'utf8').replace(/#.*$/gm, '');

/** Thân của `location <match> { … }` (một cấp ngoặc). */
function block(match) {
  const i = conf.indexOf(`location ${match} {`);
  assert.ok(i >= 0, `thiếu "location ${match}"`);
  const start = conf.indexOf('{', i) + 1;
  return conf.slice(start, conf.indexOf('}', start));
}
const ASSET_RE = 'location ~* \\.(?:';
function assetBlock() {
  const i = conf.indexOf(ASSET_RE);
  assert.ok(i >= 0, 'thiếu location regex cho tệp tĩnh ở gốc (đuôi ảnh/js/css…)');
  const start = conf.indexOf('{', i) + 1;
  return { head: conf.slice(i, start), body: conf.slice(start, conf.indexOf('}', start)) };
}
const SECURITY = 'include /etc/nginx/security-headers.conf;';

test('index.html: Cache-Control no-cache + giữ header bảo mật', () => {
  const b = block('= /index.html');
  assert.match(b, /add_header\s+Cache-Control\s+"no-cache"/);
  assert.ok(b.includes(SECURITY));
});

test('/static/ (chunk có hash): ^~, cache 1 năm immutable, thiếu → 404, 404 không mang max-age', () => {
  const b = block('^~ /static/');
  assert.match(b, /add_header\s+Cache-Control\s+"public, max-age=31536000, immutable"\s*;/, 'không dùng "always" (404 sẽ bị nhớ 1 năm)');
  assert.match(b, /try_files\s+\$uri\s+=404\s*;/);
  assert.ok(!b.includes('index.html'));
  assert.ok(b.includes(SECURITY));
});

test('tệp tĩnh không hash (login-bg.webp, logo png): cache ngắn, thiếu → 404', () => {
  const { head, body } = assetBlock();
  for (const ext of ['webp', 'png', 'js', 'css', 'ico']) assert.ok(head.includes(ext), `regex thiếu đuôi ${ext}`);
  const m = body.match(/add_header\s+Cache-Control\s+"public, max-age=(\d+)"\s*;/);
  assert.ok(m, 'thiếu Cache-Control public, max-age=… (không "always")');
  assert.ok(Number(m[1]) <= 7 * 86400, 'tệp không hash không được cache quá 7 ngày');
  assert.match(body, /try_files\s+\$uri\s+=404\s*;/);
  assert.ok(body.includes(SECURITY));
});

test('SPA fallback chỉ ở location / ; /api/ là ^~ để regex tệp tĩnh không bắt /api/…png', () => {
  assert.match(block('/'), /try_files\s+\$uri\s+\$uri\/\s+\/index\.html\s*;/);
  const fallbacks = conf.match(/try_files[^;]*\/index\.html/g) ?? [];
  assert.equal(fallbacks.length, 1, 'chỉ một chỗ được rơi về index.html');
  assert.ok(conf.includes('location ^~ /api/ {'));
});

test('header bảo mật ở mức server, và mọi location có add_header riêng đều include lại', () => {
  const header = readFileSync(path.join(WEB, 'security-headers.conf'), 'utf8');
  for (const h of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.ok(header.includes(h), `security-headers.conf thiếu ${h}`);
  }
  const serverLevel = conf.slice(conf.indexOf('server {'), conf.indexOf('location'));
  assert.ok(serverLevel.includes(SECURITY));
  for (const loc of conf.split(/\blocation\b/).slice(1)) {
    const body = loc.slice(loc.indexOf('{') + 1, loc.indexOf('}'));
    if (/add_header/.test(body)) assert.ok(body.includes(SECURITY), `location${loc.slice(0, loc.indexOf('{'))} có add_header mà thiếu include header bảo mật`);
  }
  const docker = readFileSync(path.join(WEB, 'Dockerfile'), 'utf8');
  assert.match(docker, /COPY security-headers\.conf \/etc\/nginx\/security-headers\.conf/);
});

import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Thang A: điều khiển 6, thẻ/bảng/menu 8, hộp thoại/ngăn kéo 12 — chỉ qua token; pill chỉ cho nhãn, số đếm, avatar, công tắc, tiến độ, chấm
const PILL_OK = /\.tag\b|badge|avatar|switch|progress|meter|dot|count|\bem\b|::?(before|after)/;
// Nhãn chỉ để đọc (số đếm sidebar, nhóm trên thẻ món, nợ, ghi chú giỏ) — cùng loại với .tag nhưng tên lớp riêng
const LABELS = /\.side__cnt|card__group|card-group|\.dd-debt|\.rq-cart-chip/;
const OK_PX = new Set(['0', '0px', '1px', '2px']);
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const DECL = /(?<![-\w])(border(?:-(?:top|bottom)-(?:left|right))?-radius)\s*:\s*([^;}]+)/g;

const blankComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

function reasonFor(selector, value) {
  if (/var\(--r-pill\)|\b999px\b/.test(value)) return PILL_OK.test(selector) || LABELS.test(selector) ? null : 'pill-on-control';
  const parts = value.replace(/var\([^)]*\)/g, '').split(/[\s/]+/).filter(Boolean);
  return parts.some((p) => /^\d/.test(p) && !OK_PX.has(p) && !p.endsWith('%')) ? 'px' : null;
}

export function findRadiusIssues(file, source) {
  const text = blankComments(source);
  const issues = [];
  for (const rule of text.matchAll(RULE)) {
    const selector = rule[1].replace(/^[\s\S]*;/, '').trim();
    const bodyStart = rule.index + rule[0].indexOf('{') + 1;
    for (const d of rule[2].matchAll(DECL)) {
      const value = d[2].trim();
      const reason = reasonFor(selector, value);
      if (!reason) continue;
      const line = text.slice(0, bodyStart + d.index).split('\n').length;
      issues.push({ file, line, selector, value, reason });
    }
  }
  return issues;
}

function listCss(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listCss(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

export function scanRadius(root) {
  return listCss(join(root, 'src'))
    .map((path) => relative(root, path))
    .sort()
    .flatMap((path) => findRadiusIssues(path, readFileSync(join(root, path), 'utf8')));
}

function main(root) {
  const issues = scanRadius(root);
  for (const i of issues) {
    const why = i.reason === 'px' ? 'bo góc viết px tay — dùng --r-xs/sm/md/xl' : 'pill cho điều khiển — dùng --r-sm';
    console.error(`${i.file}:${i.line} ${i.selector} { border-radius: ${i.value} } — ${why}`);
  }
  if (issues.length > 0) process.exit(1);
}

const entry = process.argv[1] && realpathSync(process.argv[1]);
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
}

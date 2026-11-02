import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Nét mảnh 0/1/2px được phép; trên --s-9 là kích thước bố cục (chừa thanh dưới, bề ngang ngăn kéo), không phải nhịp khoảng cách
const HAIRLINES = [0, 1, 2];
const DECLARATION = /(?<![-\w])(font-size|font|gap|row-gap|column-gap|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*)\s*:\s*([^;{}]+)/g;
const LENGTH = /(\d+(?:\.\d+)?)(px|rem|em|pt|ch)(?![\w-])/g;
// Tệp không chặt (giao diện nhân viên cũ) chỉ chặn cỡ chữ lẻ và đơn vị tương đối; khoảng cách px vẫn theo thang ở mọi tệp

export function readScale(tokens) {
  const fontSizes = new Set([...tokens.matchAll(/--t-[\w-]+:\s*[^;]*?\s(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));
  const spacing = new Set([...HAIRLINES, ...[...tokens.matchAll(/--s-\d+:\s*(\d+)px/g)].map((m) => Number(m[1]))]);
  return { fontSizes, spacing };
}

const blankComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

function isBad(prop, n, unit, scale, strict) {
  if (unit !== 'px') return true;
  if (prop === 'font' || prop === 'font-size') return !Number.isInteger(n) || (strict && !scale.fontSizes.has(n));
  return n <= Math.max(...scale.spacing) && !scale.spacing.has(n);
}

function badValues(prop, value, scale, strict) {
  return [...value.matchAll(LENGTH)].filter((m) => isBad(prop, Number(m[1]), m[2], scale, strict)).map((m) => `${Number(m[1])}${m[2]}`);
}

export function findScaleIssues(file, source, scale, strict) {
  const text = blankComments(source);
  const issues = [];
  for (const m of text.matchAll(DECLARATION)) {
    const line = text.slice(0, m.index).split('\n').length;
    for (const value of badValues(m[1], m[2], scale, strict)) issues.push({ file, line, prop: m[1], value });
  }
  return issues;
}

export function isChecked(path) {
  const parts = path.split(sep);
  if (parts[0] !== 'src' || !path.endsWith('.css')) return false;
  return parts[1] === 'css' || (parts[1] === 'features' && path.endsWith('.m1.css'));
}

export function isStrict(path) {
  const parts = path.split(sep);
  return parts.includes('m1') || /(^|[.-])m1\.css$/.test(parts.at(-1));
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

export function scanProject(root) {
  const scale = readScale(readFileSync(join(root, 'src', 'css', 'tokens-m1.css'), 'utf8'));
  return listFiles(join(root, 'src'))
    .map((path) => relative(root, path))
    .filter(isChecked)
    .sort()
    .flatMap((path) => findScaleIssues(path, readFileSync(join(root, path), 'utf8'), scale, isStrict(path)));
}

export function formatIssue(i) {
  return `${i.file}:${i.line} ${i.prop}: ${i.value} — ngoài thang token`;
}

function main(root) {
  const issues = scanProject(root);
  for (const i of issues) console.error(formatIssue(i));
  if (issues.length > 0) process.exit(1);
}

const entry = process.argv[1] && realpathSync(process.argv[1]);
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
}

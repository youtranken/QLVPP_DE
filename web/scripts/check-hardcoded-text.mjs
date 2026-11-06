import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Prop nhận định danh/giá trị kỹ thuật, không phải câu chữ; alt và mọi prop khác phải qua t()
const TECHNICAL_ATTRS = new Set([
  'className', 'id', 'key', 'type', 'name', 'role', 'href', 'to', 'path', 'variant', 'size', 'tone', 'mode',
  'htmlFor', 'autoComplete', 'autoCapitalize', 'inputMode', 'method', 'rel', 'target', 'src', 'accept', 'capture',
  'loading', 'scope', 'lang', 'dir', 'd', 'viewBox', 'fill', 'stroke', 'xmlns',
  'side', 'align', 'orientation', 'enterKeyHint', 'form', 'i18nKey', 'icon', 'art',
  'strokeLinecap', 'strokeLinejoin', 'strokeWidth', 'fillOpacity',
]);
const TOKEN_ARIA = new Set([
  'aria-hidden', 'aria-live', 'aria-current', 'aria-haspopup', 'aria-expanded', 'aria-controls', 'aria-labelledby',
  'aria-describedby', 'aria-busy', 'aria-modal', 'aria-invalid', 'aria-pressed', 'aria-selected', 'aria-checked',
  'aria-disabled', 'aria-orientation', 'aria-sort', 'aria-autocomplete', 'aria-atomic', 'aria-relevant',
  'aria-owns', 'aria-errormessage', 'aria-required', 'aria-readonly',
]);
const CSS_UNITS = new Set(['px', 'rem', 'em', 'vh', 'vw', 'vmin', 'vmax', 'ms', 's', 'fr', 'ch', 'deg']);
const HAS_LETTER = /\p{L}/u;
const NON_ASCII_LETTER = /(?![a-zA-Z])\p{L}/u;
// &times; &nbsp; &#215; là ký hiệu, không phải chữ cần dịch
const HTML_ENTITY = /&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/gi;
const PLACEHOLDER = '${…}';

// 'đ'/'₫' là ký hiệu tiền tệ, không phải câu chữ cần dịch
const CURRENCY_SYMBOLS = new Set(['đ', '₫']);
const hasText = (text) => !CURRENCY_SYMBOLS.has(text.trim()) && HAS_LETTER.test(text.replace(HTML_ENTITY, ''));
const isToken = (node) => ts.isStringLiteral(node) && /^[a-z][a-z-]*$/.test(node.text);
const isUnitsOnly = (text) =>
  (text.split(PLACEHOLDER).join(' ').match(/\p{L}+/gu) ?? []).every((w) => CSS_UNITS.has(w));
const isTextAttr = (name) =>
  name.startsWith('aria-')
    ? !TOKEN_ARIA.has(name)
    : !name.startsWith('data-') && !name.endsWith('ClassName') && !TECHNICAL_ATTRS.has(name);
const isToastCall = (node) => {
  const callee = node.expression;
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
  return /toast/i.test(name);
};

export function isChecked(path) {
  const parts = path.split(sep);
  if (parts.includes('locales') || (parts[0] === 'src' && parts[1] === 'test')) return false;
  // Dữ liệu mẫu chỉ test import (review-fixtures.ts, fixtures-me.ts)
  if (/(^|-)fixtures(-|\.)/.test(parts.at(-1))) return false;
  return /\.tsx?$/.test(path) && !/\.(test|d)\.tsx?$/.test(path);
}

function templateText(expr) {
  return [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)].join(PLACEHOLDER);
}

function literalTexts(expr) {
  if (ts.isParenthesizedExpression(expr)) return literalTexts(expr.expression);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [{ node: expr, text: expr.text }];
  if (ts.isTemplateExpression(expr)) return isUnitsOnly(templateText(expr)) ? [] : [{ node: expr, text: templateText(expr) }];
  if (ts.isConditionalExpression(expr)) return [...literalTexts(expr.whenTrue), ...literalTexts(expr.whenFalse)];
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return literalTexts(expr.right);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return [...literalTexts(expr.left), ...literalTexts(expr.right)];
    }
  }
  return [];
}

function stringText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return templateText(node);
  return null;
}

const isChild = (node) => ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent);

export function findHardcodedText(file, source) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const findings = [];
  const reported = new Set();
  const report = (node, text) => {
    if (reported.has(node)) return;
    reported.add(node);
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ file, line: line + 1, text: text.trim() });
  };
  const reportExpr = (expr) => {
    for (const { node, text } of literalTexts(expr)) if (hasText(text)) report(node, text);
  };
  const visitAttr = (node) => {
    const init = node.initializer;
    if (!init || !isTextAttr(node.name.getText(sf))) return;
    if (ts.isStringLiteral(init) && hasText(init.text)) report(init, init.text);
    if (ts.isJsxExpression(init) && init.expression) reportExpr(init.expression);
  };
  const visit = (node) => {
    if (ts.isJsxText(node) && hasText(node.text)) report(node, node.text);
    if (ts.isJsxAttribute(node)) visitAttr(node);
    if (ts.isJsxExpression(node) && node.expression && isChild(node)) reportExpr(node.expression);
    if (ts.isCallExpression(node) && isToastCall(node)) {
      node.arguments.forEach((arg, i) => {
        // toast('success', …): đối số đầu là loại thông báo, không phải câu chữ
        if (!(i === 0 && node.arguments.length > 1 && isToken(arg))) reportExpr(arg);
      });
    }
    const text = stringText(node);
    if (text !== null && !CURRENCY_SYMBOLS.has(text.trim()) && NON_ASCII_LETTER.test(text)) report(node, text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings.sort((a, b) => a.line - b.line);
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

export function scanProject(root) {
  return listFiles(join(root, 'src'))
    .map((path) => relative(root, path))
    .filter(isChecked)
    .sort()
    .flatMap((path) => findHardcodedText(path, readFileSync(join(root, path), 'utf8')));
}

export function formatFinding(f) {
  return `${f.file}:${f.line} chuỗi cứng "${f.text}" — dùng t()`;
}

function main(root) {
  const findings = scanProject(root);
  for (const f of findings) console.error(formatFinding(f));
  if (findings.length > 0) process.exit(1);
}

// argv[1] giữ đường dẫn symlink còn import.meta.url đã là đường dẫn thật → so sau realpath
const entry = process.argv[1] && realpathSync(process.argv[1]);
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
}

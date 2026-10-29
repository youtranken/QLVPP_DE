import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const VISIBLE_ATTRS = new Set(['aria-label', 'aria-description', 'aria-placeholder', 'title', 'placeholder', 'alt', 'label']);
const HAS_LETTER = /\p{L}/u;
// &times; &nbsp; &#215; là ký hiệu, không phải chữ cần dịch
const HTML_ENTITY = /&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/gi;

const hasText = (text) => HAS_LETTER.test(text.replace(HTML_ENTITY, ''));

export function isChecked(path) {
  return path.endsWith('.tsx') && !path.endsWith('.test.tsx');
}

// Chuỗi người dùng thấy trong một biểu thức JSX: literal, template, nhánh của ba ngôi/&&/||
function literalTexts(expr) {
  if (ts.isParenthesizedExpression(expr)) return literalTexts(expr.expression);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [{ node: expr, text: expr.text }];
  if (ts.isTemplateExpression(expr)) {
    const text = [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)].join('${…}');
    return [{ node: expr, text }];
  }
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

const isChild = (node) => ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent);

export function findHardcodedText(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const report = (node, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ file, line: line + 1, text: text.trim() });
  };
  const reportExpr = (expr) => {
    for (const { node, text } of literalTexts(expr)) if (hasText(text)) report(node, text);
  };
  const visit = (node) => {
    if (ts.isJsxText(node) && hasText(node.text)) report(node, node.text);
    if (ts.isJsxAttribute(node) && VISIBLE_ATTRS.has(node.name.getText(sf)) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) && hasText(init.text)) report(init, init.text);
      if (ts.isJsxExpression(init) && init.expression) reportExpr(init.expression);
    }
    if (ts.isJsxExpression(node) && node.expression && isChild(node)) reportExpr(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
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

function main() {
  const findings = scanProject(fileURLToPath(new URL('..', import.meta.url)));
  for (const f of findings) console.error(formatFinding(f));
  if (findings.length > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

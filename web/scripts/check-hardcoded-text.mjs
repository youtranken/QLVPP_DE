import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const VISIBLE_ATTRS = new Set(['aria-label', 'aria-description', 'aria-placeholder', 'title', 'placeholder', 'alt', 'label']);
const HAS_LETTER = /\p{L}/u;

export function isChecked(path) {
  return path.endsWith('.tsx') && !path.endsWith('.test.tsx');
}

export function findHardcodedText(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const report = (node, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ file, line: line + 1, text: text.trim() });
  };
  const visit = (node) => {
    if (ts.isJsxText(node) && HAS_LETTER.test(node.text)) report(node, node.text);
    if (ts.isJsxAttribute(node) && VISIBLE_ATTRS.has(node.name.getText(sf))) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init) && HAS_LETTER.test(init.text)) report(init, init.text);
    }
    if (ts.isJsxExpression(node) && ts.isJsxElement(node.parent) && node.expression) {
      const expr = node.expression;
      if ((ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) && HAS_LETTER.test(expr.text)) {
        report(expr, expr.text);
      }
    }
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

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const findings = listFiles(join(root, 'src'))
    .map((path) => relative(root, path))
    .filter(isChecked)
    .flatMap((path) => findHardcodedText(path, readFileSync(join(root, path), 'utf8')));
  for (const f of findings) console.error(`${f.file}:${f.line} chuỗi cứng "${f.text}" — dùng t()`);
  if (findings.length > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

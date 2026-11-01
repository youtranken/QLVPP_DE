import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import ts from 'typescript';

export const API_SRC = resolvePath(import.meta.dirname, '..', '..', '..', 'api', 'src');
const STOCK_SERVICE = join('modules', 'catalog', 'stock.service.ts');
// Chuyển tiếp action do nơi gọi truyền vào: nhãn của chúng được quét ở nơi gọi (@Audited)
const PASS_THROUGH = new Set([join('modules', 'audit', 'audit.interceptor.ts')]);

export interface Unresolved {
  where: string;
  text: string;
}

export interface ScanResult {
  actions: Set<string>;
  unresolved: Unresolved[];
}

export function stockReasons(source: string): string[] {
  const sf = ts.createSourceFile('stock.service.ts', source, ts.ScriptTarget.Latest, true);
  // Gộp mọi khai báo reason dạng union: chữ ký thu hẹp ở chỗ khác không được che mất lý do còn lại
  const reasons = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isPropertySignature(node) && node.name.getText(sf) === 'reason' && node.type && ts.isUnionTypeNode(node.type)) {
      for (const t of node.type.types) if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) reasons.add(t.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...reasons];
}

function findConst(name: string, from: ts.Node): ts.Expression | undefined {
  for (let scope: ts.Node | undefined = from.parent; scope; scope = scope.parent) {
    if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) continue;
    for (const st of scope.statements) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer) return d.initializer;
      }
    }
  }
  return undefined;
}

type Resolved = string[] | null;

function resolveTemplate(expr: ts.TemplateExpression, reasons: string[]): Resolved {
  const [span] = expr.templateSpans;
  const isReason = expr.templateSpans.length === 1 && ts.isPropertyAccessExpression(span.expression) && span.expression.name.text === 'reason';
  if (!isReason || span.literal.text !== '' || reasons.length === 0) return null;
  return reasons.map((r) => `${expr.head.text}${r}`);
}

function resolve(expr: ts.Expression, reasons: string[], depth = 0): Resolved {
  if (depth > 5) return null;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr)) return resolve(expr.expression, reasons, depth + 1);
  if (ts.isTemplateExpression(expr)) return resolveTemplate(expr, reasons);
  if (ts.isConditionalExpression(expr)) {
    const [a, b] = [resolve(expr.whenTrue, reasons, depth + 1), resolve(expr.whenFalse, reasons, depth + 1)];
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isIdentifier(expr)) {
    const init = findConst(expr.text, expr);
    return init ? resolve(init, reasons, depth + 1) : null;
  }
  return null;
}

function actionExpression(call: ts.CallExpression): ts.Expression | null {
  const callee = call.expression;
  const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
  if (name === 'Audited') return call.arguments[0] ?? null;
  if (name !== 'append' && name !== 'appendWithin') return null;
  const arg = call.arguments.at(-1);
  if (!arg || !ts.isObjectLiteralExpression(arg)) return call.expression;
  for (const p of arg.properties) {
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === 'action') return p.name;
    if (ts.isPropertyAssignment(p) && p.name.getText() === 'action') return p.initializer;
  }
  return call.expression;
}

export function scanSource(file: string, source: string, reasons: string[]): ScanResult {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const result: ScanResult = { actions: new Set(), unresolved: [] };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expr = actionExpression(node);
      if (expr && !PASS_THROUGH.has(file)) {
        const values = expr === node.expression ? null : resolve(expr, reasons);
        const where = `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
        if (values) values.forEach((v) => result.actions.add(v));
        else result.unresolved.push({ where, text: expr.getText(sf) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return result;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(e.name) && !/\.(spec|d)\.ts$/.test(e.name) ? [path] : [];
  });
}

export function scanApi(root = API_SRC): ScanResult {
  const reasons = stockReasons(readFileSync(join(root, STOCK_SERVICE), 'utf8'));
  const all: ScanResult = { actions: new Set(), unresolved: [] };
  for (const path of sourceFiles(root)) {
    const r = scanSource(path.slice(root.length + 1), readFileSync(path, 'utf8'), reasons);
    r.actions.forEach((a) => all.actions.add(a));
    all.unresolved.push(...r.unresolved);
  }
  return all;
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Ghi ref.current ngay trong thân component/hook: render đồng thời (transition, StrictMode) có thể bỏ lần render đó,
// ref giữ giá trị chưa từng commit. Ghi trong effect / sự kiện. Ngoại lệ có lý do ghi ở ALLOWED.
const ALLOWED = new Set([
  // Ghi nhớ nút mở đúng lúc render chuyển sang mở: tới effect thì ô autoFocus trong hộp đã giật focus (fix-b, dialog.test)
  'ui/dialog.tsx:Dialog',
  // Ô trong bảng đọc ref NGAY trong render (cột giữ danh tính để ô đang sửa không bị dựng lại): ghi ở effect thì ô thấy lỗi cũ
  'features/catalog/catalog-table.tsx:useColumns',
]);

const SRC = resolve(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

function renderWrites(file: string): string[] {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (node: ts.Node, fn: string | null) => {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) {
      let name = node.name && ts.isIdentifier(node.name) ? node.name.text : null;
      if (!name && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) name = node.parent.name.text;
      fn = name ?? '<anon>';
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'current' &&
      fn &&
      /^(use[A-Z]|[A-Z])/.test(fn)
    ) {
      out.push(`${relative(SRC, file)}:${fn}`);
    }
    ts.forEachChild(node, (c) => visit(c, fn));
  };
  visit(sf, null);
  return out;
}

describe('không ghi ref.current trong lúc render', () => {
  it('chỉ còn các chỗ có lý do (ALLOWED)', () => {
    const hits = [...new Set(files(SRC).flatMap(renderWrites))].filter((h) => !ALLOWED.has(h));
    expect(hits).toEqual([]);
  });
});

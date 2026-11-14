import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

// Chủ dự án chốt 14/11/2026: người dùng thấy "Tài khoản D&E", tên tích hợp "PMH ID" chỉ còn trong code/log/tài liệu
const SRC = resolve(__dirname, '..');
const BANNED = /PMH\s*ID/i;
const LOG_CALL = /(^|\.)(logger|Logger|console)\.\w+$/;

// Câu lỗi chỉ IT đọc (client OIDC/M2M, biến PMH_*): web dịch theo `code`, không hiện `message`, nên giữ tên tích hợp
const TECHNICAL: Record<string, string[]> = {
  'modules/auth/openid-client.provider.ts': ['liên hệ SA cấp client PMH ID'],
  'modules/auth/token-contract.error.ts': ['Access token PMH ID ver='],
  'modules/users/directory.client.ts': [
    'PMH ID từ chối token M2M',
    'Directory API trả 404 không đúng dạng PMH ID',
    'Không xác thực được với PMH ID (kiểm tra client_id/secret)',
  ],
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isTemplateExpression(node))
    return [
      node.head.text,
      ...node.templateSpans.map((s) => s.literal.text),
    ].join('${…}');
  return null;
}

function insideLogCall(node: ts.Node, file: ts.SourceFile): boolean {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isCallExpression(n) && LOG_CALL.test(n.expression.getText(file)))
      return true;
  }
  return false;
}

function bannedLiterals(): string[] {
  return sources(SRC).flatMap((path) => {
    const rel = relative(SRC, path).split('\\').join('/');
    const file = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const hits: string[] = [];
    const visit = (node: ts.Node): void => {
      const text = literalText(node);
      if (text !== null && BANNED.test(text) && !insideLogCall(node, file)) {
        const allowed = (TECHNICAL[rel] ?? []).some((a) => text.includes(a));
        if (!allowed) hits.push(`${rel}: ${text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    return hits;
  });
}

describe('Câu chữ api: không "PMH ID" trong chuỗi trả người dùng', () => {
  it('mọi chuỗi trong api/src (lỗi HTTP, email, chuông) ngoài log và danh sách kỹ thuật không chứa "PMH ID"', () => {
    expect(bannedLiterals()).toEqual([]);
  });

  it('danh sách kỹ thuật không thừa: mỗi mục còn khớp một chuỗi thật', () => {
    const stale = Object.entries(TECHNICAL).flatMap(([rel, list]) => {
      const text = readFileSync(join(SRC, rel), 'utf8');
      return list.filter((a) => !text.includes(a)).map((a) => `${rel}: ${a}`);
    });
    expect(stale).toEqual([]);
  });
});

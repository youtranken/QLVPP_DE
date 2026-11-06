import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findBraceIssues, formatIssue, scanProject } from './check-css-balance.mjs';

const issues = (css: string) => findBraceIssues('a.css', css).map((i) => `${i.line}: ${i.kind}`);

describe('check-css-balance', () => {
  it('ngoặc cân: luật thường, @media lồng → không lỗi', () => {
    expect(issues('a { color: red; }\n@media (max-width: 900px) {\n  b { margin: 0; }\n}\n')).toEqual([]);
  });

  it('thiếu "}" trước @media → độ sâu ≠ 0 ở cuối tệp, báo dòng mở chưa đóng', () => {
    expect(issues('a { color: red;\n@media (max-width: 900px) {\n  b { margin: 0; }\n}\n')).toEqual(['1: unclosed']);
  });

  it('thừa "}" → độ sâu xuống dưới 0 ngay tại dòng đó', () => {
    expect(issues('a { color: red; }\n}\nb { margin: 0; }\n')).toEqual(['2: extra']);
  });

  it('ngoặc trong chú thích không tính (kể cả chú thích nhiều dòng)', () => {
    expect(issues('/* { */\na { color: red; }\n/* }\n} */\n')).toEqual([]);
  });

  it('formatIssue nêu tệp:dòng và lý do', () => {
    expect(formatIssue({ file: 'src/x.css', line: 3, kind: 'extra' })).toBe('src/x.css:3 thừa "}"');
    expect(formatIssue({ file: 'src/x.css', line: 1, kind: 'unclosed' })).toBe('src/x.css:1 "{" chưa đóng tới cuối tệp');
  });

  it('scanProject quét mọi .css trong src/, bỏ qua tệp khác', () => {
    const root = mkdtempSync(join(tmpdir(), 'css-balance-'));
    try {
      mkdirSync(join(root, 'src', 'features'), { recursive: true });
      writeFileSync(join(root, 'src', 'ok.css'), 'a { b: c; }\n');
      writeFileSync(join(root, 'src', 'features', 'bad.m1.css'), 'a { b: c;\n');
      writeFileSync(join(root, 'src', 'note.ts'), 'const x = "{";\n');
      expect(scanProject(root)).toEqual([{ file: join('src', 'features', 'bad.m1.css'), line: 1, kind: 'unclosed' }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

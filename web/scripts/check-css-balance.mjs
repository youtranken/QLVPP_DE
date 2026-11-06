import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Một "}" thiếu/thừa làm trình duyệt nuốt cả các luật phía sau (vd cả khối @media) mà build không báo
const blankComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

export function findBraceIssues(file, source) {
  const text = blankComments(source);
  const opened = [];
  const issues = [];
  let line = 1;
  for (const ch of text) {
    if (ch === '\n') line += 1;
    else if (ch === '{') opened.push(line);
    else if (ch === '}' && opened.pop() === undefined) issues.push({ file, line, kind: 'extra' });
  }
  return [...issues, ...opened.slice(0, 1).map((at) => ({ file, line: at, kind: 'unclosed' }))];
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

export function scanProject(root) {
  return listFiles(join(root, 'src'))
    .filter((path) => path.endsWith('.css'))
    .map((path) => relative(root, path))
    .sort()
    .flatMap((path) => findBraceIssues(path, readFileSync(join(root, path), 'utf8')));
}

export function formatIssue(i) {
  return i.kind === 'extra' ? `${i.file}:${i.line} thừa "}"` : `${i.file}:${i.line} "{" chưa đóng tới cuối tệp`;
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

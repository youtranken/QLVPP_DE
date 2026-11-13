import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const webRoot = join(import.meta.dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

// Tên SA chỉ server biết (ô đăng nhập hỏi /api/auth/identify): bản build web không được mang tên đó, kể cả khi
// biến môi trường lúc build có tên SA (LOCAL_SA_USERNAME, hay ai đó lỡ khai VITE_LOCAL_SA_USERNAME)
describe('bản build web không chứa tên tài khoản SA', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'vpp-sa-bundle-'));
  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('build với tên SA trong env → không tệp nào trong dist có tên đó', () => {
    const secret = `sa-bi-mat-${Date.now().toString(36)}`;
    const res = spawnSync(process.execPath, [join(webRoot, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
      cwd: webRoot,
      env: { ...process.env, LOCAL_SA_USERNAME: secret, VITE_LOCAL_SA_USERNAME: secret },
      encoding: 'utf8',
    });
    expect(res.status, res.stderr).toBe(0);
    const files = filesUnder(outDir);
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);
    for (const f of files) expect(readFileSync(f, 'latin1').includes(secret), f).toBe(false);
  }, 120_000);
});

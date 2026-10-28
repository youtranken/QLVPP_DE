import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { verifyPassword } from './local-sa.service';

const SCRIPT = join(__dirname, '../../../scripts/sa-hash.mjs');

function runSaHash(input: string) {
  return spawnSync(process.execPath, [SCRIPT], { input, encoding: 'utf8' });
}

describe('npm run sa:hash', () => {
  it('không tham số → đọc mật khẩu từ stdin (bỏ xuống dòng cuối), hash verify được', () => {
    const r = runSaHash('mat-khau stdin\n');
    expect(r.status).toBe(0);
    const hash = r.stdout.trim();
    expect(verifyPassword('mat-khau stdin', hash)).toBe(true);
  });

  it('stdin rỗng → thoát mã 1, không in hash', () => {
    const r = runSaHash('');
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
  });
});

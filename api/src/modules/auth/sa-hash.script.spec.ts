import { spawn, spawnSync } from 'node:child_process';
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

  // `script` (util-linux) cấp pty thật để kiểm nhánh gõ tay trên terminal
  it('terminal (TTY) → nhắc trên stderr, không hiện chữ gõ, hash verify được', async () => {
    const child = spawn('script', ['-qc', `node ${SCRIPT}`, '/dev/null']);
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (!out.includes('Mật khẩu SA') && (out + chunk).includes('Mật khẩu SA'))
        child.stdin.write('mat-khau-tty\r');
      out += chunk;
    });
    const killer = setTimeout(() => child.kill(), 10000);
    await new Promise((r) => child.on('close', r));
    clearTimeout(killer);
    const [beforeHash] = out.split('scrypt.');
    expect(beforeHash).toContain('Mật khẩu SA');
    expect(beforeHash).not.toContain('mat-khau-tty');
    const hash = /scrypt\.[0-9a-f]+\.[0-9a-f]+/.exec(out)?.[0] ?? '';
    expect(verifyPassword('mat-khau-tty', hash)).toBe(true);
  }, 15000);
});

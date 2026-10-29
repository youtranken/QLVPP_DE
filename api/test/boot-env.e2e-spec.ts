import { execFile } from 'node:child_process';
import { join } from 'node:path';

const API_ROOT = join(__dirname, '..');

// Khởi động main.ts thật trong tiến trình con (ts-node transpile-only), env sạch như container prod
function boot(extra: Record<string, string>) {
  return new Promise<{ code: number | null; stderr: string }>((resolve) => {
    execFile(
      process.execPath,
      ['-r', 'ts-node/register', 'src/main.ts'],
      {
        cwd: API_ROOT,
        timeout: 60_000,
        env: {
          PATH: process.env.PATH ?? '',
          TS_NODE_TRANSPILE_ONLY: 'true',
          NODE_ENV: 'production',
          TRUST_PROXY_HOPS: '2',
          LOCAL_SA_USERNAME: 'sa',
          LOCAL_SA_PASSWORD_HASH: 'scrypt.00.00',
          ...extra,
        },
      },
      (error, _stdout, stderr) =>
        resolve({ code: error ? (error.code as number) : 0, stderr }),
    );
  });
}

describe('khởi động thật: CLOCK_OFFSET_MS ngoài NODE_ENV=test', () => {
  it('production + CLOCK_OFFSET_MS=1 → thoát mã 1, từ chối khởi động vì CLOCK_OFFSET_MS', async () => {
    const res = await boot({ CLOCK_OFFSET_MS: '1' });
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(
      /CLOCK_OFFSET_MS chỉ được đặt khi NODE_ENV=test/,
    );
  }, 60_000);

  it('production không có CLOCK_OFFSET_MS → qua bước kiểm đồng hồ, dừng ở bước sau (thiếu DATABASE_URL)', async () => {
    const res = await boot({});
    expect(res.code).toBe(1);
    expect(res.stderr).not.toMatch(/CLOCK_OFFSET_MS/);
    expect(res.stderr).toMatch(/Thiếu DATABASE_URL/);
  }, 60_000);
});

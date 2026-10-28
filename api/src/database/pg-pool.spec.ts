import { AddressInfo, Server, Socket, createServer } from 'node:net';
import { createPgPool } from './pg-pool';

describe('createPgPool', () => {
  let server: Server;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    // Postgres treo: nhận TCP nhưng không bao giờ trả lời bắt tay
    server = createServer((s) => sockets.push(s));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  });

  afterAll(async () => {
    sockets.forEach((s) => s.destroy());
    await new Promise((r) => server.close(r));
  });

  it('DB treo → query bị từ chối sau ~3 s (connectionTimeoutMillis 3000), health trả 503 nhanh', async () => {
    const { port } = server.address() as AddressInfo;
    const pool = createPgPool(`postgres://u:p@127.0.0.1:${port}/db`);
    const started = Date.now();
    const outcome = await Promise.race([
      pool.query('SELECT 1').then(
        () => 'resolved',
        (e: Error) => e.message,
      ),
      new Promise((r) => setTimeout(() => r('still-hanging'), 5000)),
    ]);
    const elapsed = Date.now() - started;
    void pool.end().catch(() => undefined);
    expect(outcome).toMatch(/timeout/i);
    expect(elapsed).toBeGreaterThanOrEqual(2900);
    expect(elapsed).toBeLessThan(4000);
  }, 10000);
});

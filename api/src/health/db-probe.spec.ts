import { AddressInfo, Server, Socket, createServer } from 'node:net';
import { probeDatabase } from './db-probe';

async function outcomeWithin(p: Promise<void>, ms: number) {
  let timer: NodeJS.Timeout | undefined;
  const started = Date.now();
  const outcome = await Promise.race([
    p.then(
      () => 'resolved',
      (e: Error) => e.message,
    ),
    new Promise<string>(
      (r) => (timer = setTimeout(() => r('still-hanging'), ms)),
    ),
  ]);
  clearTimeout(timer);
  return { outcome, elapsed: Date.now() - started };
}

describe('probeDatabase', () => {
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

  it('DB treo lúc kết nối → bị từ chối sau ~3 s để health trả 503 nhanh', async () => {
    const { port } = server.address() as AddressInfo;
    const { outcome, elapsed } = await outcomeWithin(
      probeDatabase(`postgres://u:p@127.0.0.1:${port}/db`),
      8000,
    );
    expect(outcome).toMatch(/timeout/i);
    expect(elapsed).toBeGreaterThanOrEqual(2900);
    expect(elapsed).toBeLessThan(6000);
  }, 15000);
});

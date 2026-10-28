import { AddressInfo, Server, Socket, connect, createServer } from 'node:net';
import { probeDatabase } from '../src/health/db-probe';
import { assertTestDatabase } from './test-database';

const QUERY_MESSAGE = 0x51; // 'Q' — simple query của giao thức Postgres

describe('probeDatabase trên Postgres thật', () => {
  const url = new URL(assertTestDatabase(process.env.DATABASE_URL));
  let proxy: Server;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    // Proxy chuyển tiếp bắt tay/xác thực nhưng nuốt câu query: DB "treo" sau khi đã kết nối
    proxy = createServer((client) => {
      const upstream = connect(Number(url.port || 5432), url.hostname);
      sockets.push(client, upstream);
      client.on('data', (chunk) => {
        if (chunk[0] !== QUERY_MESSAGE) upstream.write(chunk);
      });
      upstream.on('data', (chunk) => client.write(chunk));
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
      client.on('close', () => upstream.destroy());
    });
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r));
  });

  afterAll(async () => {
    sockets.forEach((s) => s.destroy());
    await new Promise((r) => proxy.close(r));
  });

  it('DB sống → probe thành công', async () => {
    await expect(probeDatabase(url.toString())).resolves.toBeUndefined();
  });

  it('kết nối được nhưng SELECT 1 treo → bị từ chối sau ~3 s', async () => {
    const viaProxy = new URL(url.toString());
    viaProxy.hostname = '127.0.0.1';
    viaProxy.port = String((proxy.address() as AddressInfo).port);
    let timer: NodeJS.Timeout | undefined;
    const started = Date.now();
    const outcome = await Promise.race([
      probeDatabase(viaProxy.toString()).then(
        () => 'resolved',
        (e: Error) => e.message,
      ),
      new Promise<string>(
        (r) => (timer = setTimeout(() => r('still-hanging'), 8000)),
      ),
    ]);
    clearTimeout(timer);
    const elapsed = Date.now() - started;
    expect(outcome).toMatch(/timeout/i);
    expect(elapsed).toBeGreaterThanOrEqual(2900);
    expect(elapsed).toBeLessThan(6000);
  }, 15000);
});

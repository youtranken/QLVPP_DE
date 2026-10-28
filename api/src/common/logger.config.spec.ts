import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import { httpLoggerOptions } from './logger.config';

async function logOf(path: string, headers: Record<string, string>) {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const logger = pinoHttp({ ...httpLoggerOptions(), level: 'info' }, stream);
  const server = createServer((req, res) => {
    logger(req, res);
    res.setHeader('set-cookie', 'vpp_sid=SID-SECRET');
    res.end('ok');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  await new Promise<void>((r) => server.close(() => r()));
  return lines.join('\n');
}

describe('log HTTP không lộ bí mật', () => {
  it('bỏ code/state/login_hint/logout_token khỏi URL+query, che cookie/authorization/set-cookie', async () => {
    const out = await logOf(
      '/api/auth/callback?code=CODE-SECRET&state=STATE-SECRET&login_hint=hint%40x.vn&logout_token=LT-SECRET',
      { cookie: 'vpp_sid=COOKIE-SECRET', authorization: 'Bearer AUTH-SECRET' },
    );
    expect(out).toContain('/api/auth/callback');
    for (const secret of [
      'CODE-SECRET',
      'STATE-SECRET',
      'hint',
      'LT-SECRET',
      'COOKIE-SECRET',
      'AUTH-SECRET',
      'SID-SECRET',
    ]) {
      expect(out).not.toContain(secret);
    }
  });
});

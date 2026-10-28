import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './test-app.helper';

const XFF = '1.2.3.4, 10.0.0.9, 172.18.0.2';

async function ipSeenWithHops(hops: string): Promise<string> {
  process.env.TRUST_PROXY_HOPS = hops;
  const app = (await createTestApp()) as INestApplication<App>;
  try {
    const res = await request(app.getHttpServer())
      .get('/api/_ip')
      .set('X-Forwarded-For', XFF)
      .expect(200);
    return (res.body as { ip: string }).ip;
  } finally {
    await app.close();
  }
}

describe('trust proxy theo TRUST_PROXY_HOPS', () => {
  const original = process.env.TRUST_PROXY_HOPS;

  afterAll(() => {
    if (original === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = original;
  });

  it('2 hop (EDGE → web nginx) → req.ip là entry thứ hai từ phải', async () => {
    expect(await ipSeenWithHops('2')).toBe('10.0.0.9');
  });

  it('1 hop → req.ip là entry ngoài cùng bên phải', async () => {
    expect(await ipSeenWithHops('1')).toBe('172.18.0.2');
  });
});

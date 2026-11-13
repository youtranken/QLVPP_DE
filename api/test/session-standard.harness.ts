import { INestApplication, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as jose from 'jose';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { cookieSecure } from '../src/modules/auth/auth.controller';
import { JwtVerifierService } from '../src/modules/auth/jwt-verifier.service';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const ISSUER = 'https://id.e2e-sh.test/oidc';
const CLIENT_ID = 'client_vpp_e2e_sh';
export const SA_USER = 'sa-sh-e2e';
export const SA_PASS = 'sa-sh-pass';
export const TEST_PASS = 'test-sh-pass';
const ENC_KEY = 'e2e-session-hash-key-0123456789abcdef0123';
const KEYS = [
  'PMH_ISSUER_URL',
  'PMH_CLIENT_ID',
  'LOCAL_SA_USERNAME',
  'LOCAL_SA_PASSWORD_HASH',
  'AUTH_DEV_MODE',
  'LOCAL_TEST_ACCOUNTS',
  'CONFIG_ENC_KEY',
] as const;
const LOG_METHODS = [
  'log',
  'warn',
  'error',
  'debug',
  'verbose',
  'fatal',
] as const;

type Row = Record<string, unknown>;

// Bộ khung chung cho test chuẩn phiên (luật 1–8): app thật với PMH ID giả (JWT ký local), SA, tài khoản
// thử; ghi lại mọi cookie/token thô đã phát và mọi log để quét "không lộ ở đâu".
export class SessionHarness {
  app!: INestApplication<App>;
  pool!: Pool;
  readonly suffix = randomUUID().slice(0, 8);
  readonly pmhSub = `e2e-sh-pmh-${this.suffix}`;
  readonly testSub = `local-test-e2e-sh-${this.suffix}`;
  readonly secrets: string[] = [];
  readonly logs: string[] = [];
  loginTokens = { refreshToken: '', idToken: '' };
  lastAccess = '';
  refreshCount = 0;
  private privateKey!: jose.CryptoKey;
  private readonly spies: jest.SpyInstance[] = [];
  private readonly saved = Object.fromEntries(
    KEYS.map((k) => [k, process.env[k]]),
  );

  async start(): Promise<void> {
    this.pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    process.env.PMH_ISSUER_URL = ISSUER;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    process.env.LOCAL_SA_USERNAME = SA_USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(SA_PASS);
    process.env.AUTH_DEV_MODE = 'true';
    process.env.CONFIG_ENC_KEY = ENC_KEY;
    process.env.LOCAL_TEST_ACCOUNTS = JSON.stringify([
      {
        username: 'sh.e2e',
        password_hash: hashPassword(TEST_PASS),
        role: 'member',
        sub: this.testSub,
        name: 'SH E2E',
      },
    ]);
    this.captureLogs();
    await this.cleanup();
    this.app = (await createTestApp(
      [],
      [
        { token: OIDC_PROVIDER, useValue: this.provider() },
        { token: DIRECTORY_CLIENT, useValue: directoryStub() },
      ],
    )) as INestApplication<App>;
    const pair = await jose.generateKeyPair('RS256');
    this.privateKey = pair.privateKey;
    this.app.get(JwtVerifierService).setKeySource(
      jose.createLocalJWKSet({
        keys: [await jose.exportJWK(pair.publicKey)],
      }),
    );
  }

  async stop(): Promise<void> {
    await this.app.close();
    for (const s of this.spies) s.mockRestore();
    await this.cleanup();
    await this.pool.query('DELETE FROM users WHERE sub = ANY($1)', [
      [this.pmhSub, this.testSub],
    ]);
    await this.pool.end();
    for (const k of KEYS) {
      if (this.saved[k] === undefined) delete process.env[k];
      else process.env[k] = this.saved[k];
    }
  }

  async cleanup(): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE user_sub = ANY($1)', [
      [this.pmhSub, this.testSub, 'local:sa'],
    ]);
  }

  // Bắt mọi log Nest (Logger instance + static) và console — app test tắt in ra, nhưng lời gọi vẫn đi qua đây
  private captureLogs(): void {
    const capture = (...args: unknown[]) => {
      this.logs.push(
        args
          .map((a) =>
            a instanceof Error
              ? `${a.message}\n${a.stack ?? ''}`
              : typeof a === 'string'
                ? a
                : JSON.stringify(a),
          )
          .join(' '),
      );
    };
    for (const m of LOG_METHODS) {
      this.spies.push(
        jest.spyOn(Logger.prototype, m).mockImplementation(capture as never),
        jest.spyOn(Logger, m).mockImplementation(capture as never),
      );
    }
    for (const m of ['log', 'warn', 'error', 'info', 'debug'] as const) {
      this.spies.push(jest.spyOn(console, m).mockImplementation(capture));
    }
  }

  private provider() {
    return {
      buildAuthUrl: () => Promise.resolve('https://id.e2e-sh.test/auth'),
      exchangeCode: () =>
        Promise.resolve({
          accessToken: this.lastAccess,
          refreshToken: this.loginTokens.refreshToken,
          idToken: this.loginTokens.idToken,
        }),
      refresh: async () => {
        this.refreshCount += 1;
        return {
          accessToken: await this.signAccess(),
          refreshToken: this.issued('rt-rotated'),
          idToken: null,
        };
      },
      buildLogoutUrl: () => Promise.resolve(null),
      clientCredentialsToken: () => Promise.resolve('m2m'),
    };
  }

  async signAccess(): Promise<string> {
    const iat = Math.floor(Date.now() / 1000);
    const token = await new jose.SignJWT({
      email: `${this.pmhSub}@pmh.test`,
      full_name: 'SH PMH',
      ver: 3,
      app_role: 'member',
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(this.pmhSub)
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 300)
      .sign(this.privateKey);
    this.secrets.push(token);
    return token;
  }

  issued(kind: string): string {
    const v = `${kind}-${this.suffix}-${randomUUID()}`;
    this.secrets.push(v);
    return v;
  }

  // Lấy cookie vpp_sid từ Set-Cookie; luật 1, 5–6: 43 ký tự base64url, cookie phiên trình duyệt
  // (không Max-Age/Expires), HttpOnly, SameSite=Strict, Path=/, Secure theo cookieSecure()
  cookieOf(res: request.Response): string {
    const header = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => /^vpp_sid=[^;]/.test(c));
    expect(header).toBeDefined();
    const value = /^vpp_sid=([^;]*)/.exec(header!)?.[1];
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    this.secrets.push(value!);
    expect(header).toMatch(/; HttpOnly/);
    expect(header).toMatch(/; SameSite=Strict/);
    expect(header).toMatch(/; Path=\/(;|$)/);
    expect(header).not.toMatch(/Max-Age|Expires/i);
    expect(/; Secure/.test(header!)).toBe(cookieSecure());
    return value!;
  }

  server() {
    return this.app.getHttpServer();
  }

  me(cookie: string) {
    return request(this.server())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${cookie}`);
  }

  async pmhLogin(): Promise<string> {
    this.lastAccess = await this.signAccess();
    this.loginTokens = {
      refreshToken: this.issued('rt'),
      idToken: this.issued('idt'),
    };
    const tx = JSON.stringify({ codeVerifier: 'v', state: 'st' });
    const res = await request(this.server())
      .get('/api/auth/callback?code=c&state=st')
      .set('Cookie', `vpp_oidc_tx=${encodeURIComponent(tx)}`)
      .expect(302);
    expect(res.headers.location).toBe('/');
    return this.cookieOf(res);
  }

  async saLogin(): Promise<string> {
    const res = await request(this.server())
      .post('/api/auth/sa-login')
      .send({ username: SA_USER, password: SA_PASS })
      .expect(200);
    return this.cookieOf(res);
  }

  async testLogin(): Promise<string> {
    const res = await request(this.server())
      .post('/api/auth/test-login')
      .send({ username: 'sh.e2e', password: TEST_PASS })
      .expect(200);
    return this.cookieOf(res);
  }

  async sessionRows(sub: string): Promise<Row[]> {
    return (
      await this.pool.query('SELECT * FROM sessions WHERE user_sub = $1', [sub])
    ).rows as Row[];
  }

  // Nhật ký phiên kết thúc ghi không chờ: đợi tới khi đủ số dòng mong đợi (tối đa ~2 s)
  async auditRows(
    actor: string,
    action: string,
    objectId?: string,
    expected = 1,
  ): Promise<Row[]> {
    let rows: Row[] = [];
    for (let i = 0; i < 40; i += 1) {
      rows = (
        await this.pool.query(
          `SELECT * FROM audit_log WHERE actor = $1 AND action = $2
             AND ($3::text IS NULL OR object_id = $3) ORDER BY created_at`,
          [actor, action, objectId ?? null],
        )
      ).rows as Row[];
      if (rows.length >= expected) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    return rows;
  }

  async auditApi(actor: string, action: string) {
    return (
      await request(this.server())
        .get('/api/admin/audit')
        .query({ actor, action })
        .set('x-dev-user-sub', 'dev-admin')
        .set('x-dev-role', 'admin')
        .expect(200)
    ).body as { items: Array<{ objectType: string; objectId: string }> };
  }

  // Luật 8: quét toàn bộ bảng sessions, mọi dòng Nhật ký của các actor trong suite và log bắt được
  async expectNoSecretAnywhere(): Promise<void> {
    const sessions = JSON.stringify(
      (await this.pool.query('SELECT * FROM sessions')).rows,
    );
    const audits = JSON.stringify(
      (
        await this.pool.query('SELECT * FROM audit_log WHERE actor = ANY($1)', [
          [this.pmhSub, this.testSub, 'local:sa', 'system'],
        ])
      ).rows,
    );
    const logText = this.logs.join('\n');
    expect(this.secrets.length).toBeGreaterThan(0);
    for (const s of this.secrets) {
      expect(sessions).not.toContain(s);
      expect(audits).not.toContain(s);
      expect(logText).not.toContain(s);
    }
  }
}

import { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ROLES_KEY } from '../src/modules/auth/roles.decorator';
import type { AppRole } from '../src/modules/auth/roles.decorator';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const SA = 'e2e-sa-role';

// Vai A = admin + sa: mỗi @Roles tự liệt kê 'sa', thiếu một chỗ là SA mất quyền ở route đó
describe('vai sa trên admin/*', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    delete process.env.AUTH_DEV_MODE;
  });

  const as = (path: string, role: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('x-dev-user-sub', SA)
      .set('x-dev-role', role);

  it.each([
    '/api/admin/config',
    '/api/admin/periods/2001-01/summary',
    '/api/admin/audit',
    '/api/admin/review',
    '/api/admin/stock/low',
  ])('x-dev-role sa → GET %s 200; member → 403', async (path) => {
    await as(path, 'sa').expect(200);
    await as(path, 'member').expect(403);
  });

  it("mọi route @Roles có 'admin' cũng có 'sa'", () => {
    const missing: string[] = [];
    for (const mod of app.get(ModulesContainer).values()) {
      for (const { metatype } of mod.controllers.values()) {
        if (typeof metatype !== 'function') continue;
        const proto = metatype.prototype as Record<string, unknown>;
        const handlers = Object.getOwnPropertyNames(proto)
          .filter((name) => name !== 'constructor')
          .map((name) => [name, proto[name]] as const);
        for (const [name, target] of [
          ['(class)', metatype] as const,
          ...handlers,
        ]) {
          if (typeof target !== 'function') continue;
          const roles = Reflect.getMetadata(ROLES_KEY, target) as
            AppRole[] | undefined;
          if (roles?.includes('admin') && !roles.includes('sa'))
            missing.push(`${metatype.name}.${name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

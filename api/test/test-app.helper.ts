import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';

export interface ProviderOverride {
  token: unknown;
  useValue: unknown;
}

export async function createTestApp(
  extraControllers: Array<new (...args: never[]) => unknown> = [],
  overrides: ProviderOverride[] = [],
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: extraControllers,
  });
  // Mặc định Directory là stub lỗi: test không bao giờ chạm PMH ID thật, scheduler boot cũng vậy.
  const all = overrides.some((o) => o.token === DIRECTORY_CLIENT)
    ? overrides
    : [{ token: DIRECTORY_CLIENT, useValue: directoryDown() }, ...overrides];
  for (const o of all) {
    builder = builder.overrideProvider(o.token).useValue(o.useValue);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication({ logger: false, rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

function directoryDown() {
  return directoryStub([], {
    fetchUsers: () =>
      Promise.reject(
        new ServiceUnavailableException({ code: 'DIRECTORY_UNAVAILABLE' }),
      ),
  });
}

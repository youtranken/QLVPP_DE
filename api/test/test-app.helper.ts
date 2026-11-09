import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MAIL_TRANSPORT } from '../src/modules/mail/mail-transport';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { fakeMailTransport } from './mail.fake';

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
  // Mail cũng vậy: transport giả, không bao giờ mở kết nối SMTP
  const has = (token: unknown) => overrides.some((o) => o.token === token);
  const all = [
    ...(has(DIRECTORY_CLIENT)
      ? []
      : [{ token: DIRECTORY_CLIENT, useValue: directoryDown() }]),
    ...(has(MAIL_TRANSPORT)
      ? []
      : [{ token: MAIL_TRANSPORT, useValue: fakeMailTransport() }]),
    ...overrides,
  ];
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

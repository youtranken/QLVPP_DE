import { INestApplication } from '@nestjs/common';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { createTestApp } from './test-app.helper';

describe('createTestApp không bao giờ chạm PMH ID thật', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
    jest.restoreAllMocks();
  });

  it('jest setup đã xóa mọi biến PMH_*', () => {
    expect(
      Object.keys(process.env).filter((k) => k.startsWith('PMH_')),
    ).toEqual([]);
  });

  it('mặc định Directory là stub lỗi, scheduler boot không gọi fetch', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    app = await createTestApp();
    const client = app.get<ReturnType<typeof directoryStub>>(DIRECTORY_CLIENT);
    await expect(client.fetchUsers()).rejects.toMatchObject({
      response: { code: 'DIRECTORY_UNAVAILABLE' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('test vẫn override được Directory', async () => {
    const mine = directoryStub([]);
    app = await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: mine }],
    );
    expect(app.get(DIRECTORY_CLIENT)).toBe(mine);
  });
});

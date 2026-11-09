import { UserAccessService } from './user-access.service';

describe('UserAccessService.accessLost', () => {
  it('gọi mọi người nghe theo thứ tự; người nghe lỗi không làm gãy người gọi hay người nghe sau', async () => {
    const service = new UserAccessService(
      {} as never,
      {} as never,
      {} as never,
    );
    const calls: string[] = [];
    service.onAccessLost(() => Promise.reject(new Error('db down')));
    service.onAccessLost((sub, status) => {
      calls.push(`${sub}:${status}`);
      return Promise.resolve();
    });
    await expect(service.accessLost('u1', 'deleted')).resolves.toBeUndefined();
    expect(calls).toEqual(['u1:deleted']);
  });
});

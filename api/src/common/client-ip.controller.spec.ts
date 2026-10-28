import {
  ClientIpController,
  testOnlyControllers,
} from './client-ip.controller';

describe('route test GET /api/_ip', () => {
  it('chỉ đăng ký khi NODE_ENV=test', () => {
    expect(testOnlyControllers({ NODE_ENV: 'test' })).toEqual([
      ClientIpController,
    ]);
  });

  it.each(['production', 'development', undefined])(
    'NODE_ENV=%p → không đăng ký',
    (nodeEnv) => {
      expect(testOnlyControllers({ NODE_ENV: nodeEnv })).toEqual([]);
    },
  );
});

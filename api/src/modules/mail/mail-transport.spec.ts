import {
  createSmtpTransport,
  smtpConfigFromEnv,
  smtpTransportOptions,
} from './mail-transport';
import { MailOutbox } from './mail-outbox';
import type { MailTransport } from './mail-transport';

const FULL = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'bot@example.test',
  SMTP_PASS: 's3cret-pass',
  SMTP_FROM: 'VPP <bot@example.test>',
};

describe('smtpConfigFromEnv', () => {
  it('thiếu SMTP_HOST hoặc SMTP_FROM → null (tắt email)', () => {
    expect(smtpConfigFromEnv({})).toBeNull();
    expect(smtpConfigFromEnv({ ...FULL, SMTP_HOST: '' })).toBeNull();
    expect(smtpConfigFromEnv({ ...FULL, SMTP_FROM: '  ' })).toBeNull();
  });

  it('đủ biến → cấu hình; PORT mặc định 587, SECURE chỉ nhận "true"', () => {
    expect(smtpConfigFromEnv(FULL)).toEqual({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      user: 'bot@example.test',
      pass: 's3cret-pass',
      from: 'VPP <bot@example.test>',
    });
    const min = smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_FROM: 'f@x' });
    expect(min).toMatchObject({ port: 587, secure: false, user: '', pass: '' });
    expect(
      smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_FROM: 'f', SMTP_SECURE: '1' })
        ?.secure,
    ).toBe(false);
  });
});

describe('createSmtpTransport', () => {
  it('env thiếu → transport tắt, WARN đúng một lần, send không làm gì', async () => {
    const warn = jest.fn();
    const t = createSmtpTransport({ SMTP_HOST: 'h' }, { warn, log: jest.fn() });
    expect(t.enabled).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    await expect(
      t.send({ to: ['a@x'], subject: 's', text: 't' }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('env đủ → bật, không mở kết nối lúc tạo, log không chứa mật khẩu', () => {
    const log = jest.fn();
    const warn = jest.fn();
    const t = createSmtpTransport(FULL, { warn, log });
    expect(t.enabled).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('s3cret-pass');
  });
});

describe('smtpTransportOptions', () => {
  it('đặt timeout kết nối/chào/socket hữu hạn (không dùng mặc định 10 phút của nodemailer)', () => {
    const cfg = smtpConfigFromEnv(FULL)!;
    expect(smtpTransportOptions(cfg)).toEqual({
      host: 'smtp.example.test',
      port: 465,
      secure: true,
      auth: { user: 'bot@example.test', pass: 's3cret-pass' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    expect(smtpTransportOptions({ ...cfg, user: '' }).auth).toBeUndefined();
  });
});

describe('MailOutbox', () => {
  it('tắt app: chờ thư đang gửi tối đa shutdownMs rồi thôi, WARN số thư bỏ dở', async () => {
    jest.useFakeTimers();
    try {
      const warn = jest.fn();
      const hang: MailTransport = {
        enabled: true,
        send: () => new Promise<void>(() => undefined),
      };
      const outbox = new MailOutbox(hang, { warn }, 10_000);
      outbox.enqueue({ to: ['a@x'], subject: 's', text: 't' });
      let done = false;
      const p = outbox.onModuleDestroy().then(() => {
        done = true;
      });
      await jest.advanceTimersByTimeAsync(9_999);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await p;
      expect(done).toBe(true);
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'mail_shutdown_timeout', pending: 1 }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('tắt app khi không có thư đang gửi → xong ngay, không WARN', async () => {
    const warn = jest.fn();
    const outbox = new MailOutbox(
      { enabled: true, send: () => Promise.resolve() },
      { warn },
    );
    outbox.enqueue({ to: ['a@x'], subject: 's', text: 't' });
    await outbox.onModuleDestroy();
    expect(warn).not.toHaveBeenCalled();
  });

  it('gửi lỗi chỉ log WARN (không ném, không lộ địa chỉ/nội dung); idle() chờ hết', async () => {
    const warn = jest.fn();
    const transport: MailTransport = {
      enabled: true,
      send: () =>
        Promise.reject(
          Object.assign(new Error('auth failed for s3cret-pass'), {
            code: 'EAUTH',
            responseCode: 535,
          }),
        ),
    };
    const outbox = new MailOutbox(transport, { warn });
    outbox.enqueue({ to: ['admin@x'], subject: 'Bí mật', text: 'nội dung' });
    await outbox.idle();
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('EAUTH');
    expect(logged).not.toContain('s3cret-pass');
    expect(logged).not.toContain('admin@x');
    expect(logged).not.toContain('nội dung');
  });

  it('transport tắt hoặc không người nhận → không gọi send', async () => {
    const send = jest.fn(() => Promise.resolve());
    new MailOutbox({ enabled: false, send }, { warn: jest.fn() }).enqueue({
      to: ['a@x'],
      subject: 's',
      text: 't',
    });
    const on = new MailOutbox({ enabled: true, send }, { warn: jest.fn() });
    on.enqueue({ to: [], subject: 's', text: 't' });
    await on.idle();
    expect(send).not.toHaveBeenCalled();
  });
});

import type {
  MailMessage,
  MailTransport,
} from '../src/modules/mail/mail-transport';

// Transport giả cho test: ghi lại thư, không bao giờ mở kết nối SMTP
export interface FakeMailTransport extends MailTransport {
  sent: MailMessage[];
}

export function fakeMailTransport(): FakeMailTransport {
  const sent: MailMessage[] = [];
  return {
    enabled: true,
    sent,
    send: (msg) => {
      sent.push(msg);
      return Promise.resolve();
    },
  };
}

import { Logger, Module } from '@nestjs/common';
import { MailOutbox } from './mail-outbox';
import { createSmtpTransport, MAIL_TRANSPORT } from './mail-transport';
import type { MailTransport } from './mail-transport';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      useFactory: (): MailTransport =>
        createSmtpTransport(process.env, new Logger('MailTransport')),
    },
    {
      provide: MailOutbox,
      useFactory: (t: MailTransport) =>
        new MailOutbox(t, new Logger(MailOutbox.name)),
      inject: [MAIL_TRANSPORT],
    },
  ],
  exports: [MailOutbox],
})
export class MailModule {}

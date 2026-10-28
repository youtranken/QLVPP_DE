import { Global, Module } from '@nestjs/common';
import { ClockService } from './clock.service';

// Global: mọi module đọc "bây giờ" qua một nguồn để test dời được ngày
@Global()
@Module({
  providers: [
    { provide: ClockService, useFactory: () => new ClockService(process.env) },
  ],
  exports: [ClockService],
})
export class ClockModule {}

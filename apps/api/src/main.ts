import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { parseEnv } from './infra/config/env';
import { loadRootEnv } from './infra/config/load-env';

/** Điểm khởi động HTTP. Config sai/thiếu → fail-fast tại đây. */
async function bootstrap(): Promise<void> {
  loadRootEnv();
  const config = parseEnv();
  // `rawBody` cần cho webhook PMH ID: HMAC phải tính trên ĐÚNG byte gốc,
  // JSON.stringify lại body đã parse sẽ ra chuỗi khác và chữ ký không khớp.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: config.WEB_ORIGIN.split(','), credentials: true });
  // Cookie phiên BFF (`vpp_sid`) và cookie tạm của luồng OIDC được đọc qua req.cookies.
  app.use(cookieParser());
  // Cần cho DbModule.onApplicationShutdown đóng pool khi nhận SIGTERM/SIGINT.
  app.enableShutdownHooks();
  await app.listen(config.API_PORT);
  console.log(`API listening on :${config.API_PORT}`);
}

void bootstrap();

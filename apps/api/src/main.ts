import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { parseEnv } from './infra/config/env';
import { loadRootEnv } from './infra/config/load-env';

/** Điểm khởi động HTTP. Config sai/thiếu → fail-fast tại đây. */
async function bootstrap(): Promise<void> {
  loadRootEnv();
  const config = parseEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: config.WEB_ORIGIN.split(','), credentials: true });
  // Cần cho DbModule.onApplicationShutdown đóng pool khi nhận SIGTERM/SIGINT.
  app.enableShutdownHooks();
  await app.listen(config.API_PORT);
  console.log(`API listening on :${config.API_PORT}`);
}

void bootstrap();

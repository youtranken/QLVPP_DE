import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

function requiredPort(): number {
  const raw = process.env.PORT ?? '3000';
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT không hợp lệ: ${JSON.stringify(raw)}`);
  }
  return port;
}

async function bootstrap(): Promise<void> {
  const port = requiredPort();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: Error) => {
  console.error('[FATAL] Khởi động thất bại:', error);
  process.exit(1);
});

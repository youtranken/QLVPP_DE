import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { validationException } from './common/validation-error';

// Dùng chung main.ts và test e2e để e2e không trôi khỏi production; rawBody đặt lúc tạo app (webhook HMAC)
export function configureApp(app: INestApplication): INestApplication {
  const express = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  express.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  return app;
}

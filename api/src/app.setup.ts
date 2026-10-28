import { INestApplication } from '@nestjs/common';

// Dùng chung main.ts và test e2e để e2e không trôi khỏi production
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  return app;
}

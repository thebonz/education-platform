import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { env } from './config/env';

async function bootstrap() {
  const config = env(); // dừng ngay nếu cấu hình sai
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  app.useBodyParser('json', { limit: '100kb' });
  configureApp(app);
  await app.listen(config.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`HappyClass API listening on ${config.PORT} (${config.NODE_ENV})`);
}
bootstrap();

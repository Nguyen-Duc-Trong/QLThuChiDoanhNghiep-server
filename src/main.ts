import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.setGlobalPrefix('api');
  // Đọc cookie vào req.cookies (cần cho CookieStrategy lấy refreshToken)
  app.use(cookieParser());
  // ValidationPipe, ResponseInterceptor, HttpExceptionFilter được đăng ký global trong AppModule
  await app.listen(process.env.PORT ?? 3000);

}
await bootstrap();

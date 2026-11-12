import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { HttpExceptionFilter, ResponseInterceptor } from './common/response.js';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbModule } from './database/db.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RolesModule } from './roles/roles.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    // Nạp biến môi trường: ưu tiên server/.env, sau đó .env ở thư mục gốc.
    // Biến đã có sẵn (vd do docker-compose truyền vào) sẽ không bị ghi đè.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    DbModule,
    RedisModule,
    RolesModule,
    UsersModule,
    AuthModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Kiểm tra dữ liệu đầu vào theo các decorator của class-validator trong DTO
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // loại bỏ field không khai báo trong DTO
        transform: true, // chuyển body thành instance của DTO
      }),
    },
    // Global Interceptor: bọc mọi response thành công theo định dạng chung
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Global Exception Filter: trả mọi lỗi theo cùng định dạng
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}

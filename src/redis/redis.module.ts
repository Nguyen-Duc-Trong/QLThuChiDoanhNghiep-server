import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

@Global() // dùng chung toàn app, module khác không cần import lại
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('Redis');
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          // Tự kết nối lại, tối đa chờ 2s giữa các lần thử
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });

        client.on('connect', () => logger.log('Đã kết nối Redis'));
        client.on('error', (err) => logger.error(`Lỗi Redis: ${err.message}`));

        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}

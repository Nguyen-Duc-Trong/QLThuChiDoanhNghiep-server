import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** Client gốc, dùng khi cần lệnh không có sẵn trong service */
  getClient(): Redis {
    return this.client;
  }

  async setSession(key:string, jti:string, timelive: number): Promise<void> {
    await this.client.set(key, jti, 'EX', timelive);
  }

  async getSession(key:string): Promise<string | null> {
    return await this.client.get(key);
  }

  async deleteSession(key:string): Promise<void> {
    await this.client.del(key);
  }

  /** Xoá mọi key khớp pattern (vd: `refresh_token:<userId>:*`). Dùng SCAN để không chặn Redis như KEYS */
  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');
    return deleted;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

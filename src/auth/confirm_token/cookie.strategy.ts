import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service.js';

// Tên strategy, dùng trong AuthGuard('jwt-refresh')
export const REFRESH_STRATEGY = 'jwt-refresh';

// Payload của refresh token (khớp với createToken trong AuthService)
export interface RefreshPayload {
  sub: string;
  jti: string;
}

// Dữ liệu gắn vào req.user sau khi xác thực thành công
export interface RefreshUser {
  userId: string;
  jti: string;
}

// Lấy refresh token từ cookie httpOnly (cần cookie-parser trong main.ts)
const fromRefreshCookie = (req: Request): string | null =>
  (req?.cookies?.refreshToken as string | undefined) ?? null;

/**
 * Xác thực refresh token nằm trong cookie:
 * 1. passport-jwt kiểm tra chữ ký (JWT_REFRESH_SECRET) và hạn dùng
 * 2. validate() kiểm tra phiên còn trong Redis -> token đã logout/thu hồi sẽ bị từ chối
 */
@Injectable()
export class CookieStrategy extends PassportStrategy(Strategy, REFRESH_STRATEGY) {
  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromRefreshCookie]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: RefreshPayload): Promise<RefreshUser> {
    if (!payload?.sub || !payload?.jti) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const key = `refresh_token:${payload.sub}:${payload.jti}`;
    const stored = await this.redis.getSession(key);
    if (stored !== payload.jti) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc đã bị thu hồi',
      );
    }

    return { userId: payload.sub, jti: payload.jti };
  }
}

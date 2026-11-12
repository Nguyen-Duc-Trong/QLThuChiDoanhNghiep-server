import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { RoleKey } from '../../common/types.js';

// Tên strategy, dùng trong AuthGuard('jwt')
export const ACCESS_STRATEGY = 'jwt';

// Payload của access token (khớp với AuthService.signAccessToken)
export interface AccessPayload {
  sub: string;
  username: string;
  email: string;
  role: RoleKey;
}

// Dữ liệu gắn vào req.user sau khi xác thực thành công
export interface AuthUser {
  userId: string;
  username: string;
  email: string;
  role: RoleKey;
}

const fromAccessCookie = (req: Request): string | null =>
  (req?.cookies?.accessToken as string | undefined) ?? null;

/**
 * Xác thực access token nằm trong cookie httpOnly `accessToken`.
 * Hỗ trợ thêm header `Authorization: Bearer ...` để test bằng Postman/Swagger.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, ACCESS_STRATEGY) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromAccessCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: AccessPayload): AuthUser {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException('Access token không hợp lệ');
    }
    return { userId: payload.sub, username: payload.username, email: payload.email, role: payload.role };
  }
}

import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ACCESS_STRATEGY, type AuthUser } from '../confirm_token/jwt.strategy.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard GLOBAL (đăng ký APP_GUARD trong AuthModule): mọi route đều phải đăng nhập,
 * trừ route gắn @Public().
 *
 * Client dựa vào mã 401 để tự gọi /refresh rồi gửi lại request.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(ACCESS_STRATEGY) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser = AuthUser>(err: unknown, user: TUser | false, info: unknown): TUser {
    if (err) {
      throw err instanceof Error ? err : new UnauthorizedException('Xác thực thất bại');
    }
    if (!user) {
      const name = info instanceof Error ? info.name : undefined;
      if (name === 'TokenExpiredError') {
        throw new UnauthorizedException('Phiên làm việc đã hết hạn');
      }
      if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
        throw new UnauthorizedException('Access token không hợp lệ');
      }
      throw new UnauthorizedException('Bạn chưa đăng nhập');
    }
    return user;
  }
}

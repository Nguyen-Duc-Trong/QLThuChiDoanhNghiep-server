import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../confirm_token/jwt.strategy.js';

/**
 * Lấy người dùng đang đăng nhập (do JwtStrategy gắn vào req.user).
 * Ví dụ: me(@CurrentUser() user: AuthUser)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);

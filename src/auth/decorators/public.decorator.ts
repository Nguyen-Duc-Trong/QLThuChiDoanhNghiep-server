import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Đánh dấu route không cần đăng nhập (login, refresh, logout...).
 * Mọi route khác mặc định bị JwtAuthGuard (global) chặn nếu chưa đăng nhập.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

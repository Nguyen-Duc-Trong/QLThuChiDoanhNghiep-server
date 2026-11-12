import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  REFRESH_STRATEGY,
  type RefreshUser,
} from '../confirm_token/cookie.strategy.js';

/**
 * Bảo vệ route cần refresh token trong cookie (vd: /refresh, /logout).
 * Chạy CookieStrategy -> hợp lệ thì req.user = { userId, jti }.
 *
 * Dùng: @UseGuards(RefreshTokenGuard)
 */
@Injectable()
export class RefreshTokenGuard extends AuthGuard(REFRESH_STRATEGY) {
  /**
   * Mặc định AuthGuard chỉ trả 401 "Unauthorized" chung chung.
   * Ghi đè để trả thông báo rõ ràng theo từng trường hợp lỗi.
   *
   * err : lỗi ném ra từ validate() (vd: phiên đã bị thu hồi trong Redis)
   * user: giá trị validate() trả về, false nếu xác thực thất bại
   * info: lỗi từ passport-jwt (thiếu token, hết hạn, sai chữ ký...)
   */
  override handleRequest<TUser = RefreshUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    // Lỗi từ validate() đã là UnauthorizedException kèm thông báo -> ném lại nguyên vẹn
    if (err) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Xác thực refresh token thất bại');
    }

    if (!user) {
      const name = info instanceof Error ? info.name : undefined;

      if (name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
        );
      }
      if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }
      // Không có cookie refreshToken (passport-jwt báo "No auth token")
      throw new UnauthorizedException(
        'Không tìm thấy refresh token, vui lòng đăng nhập',
      );
    }

    return user;
  }
}

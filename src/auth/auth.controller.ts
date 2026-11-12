import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import type { CookieOptions, Response } from 'express';
import { RefreshTokenGuard } from './gaurds/refresh-token.guard.js';
import { RefreshUser } from './confirm_token/cookie.strategy.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthUser } from './confirm_token/jwt.strategy.js';
import { ResponseMessage } from '../common/response.js';

// Dùng chung cho res.cookie và res.clearCookie: options phải khớp thì trình duyệt mới xoá được cookie
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const ACCESS_MAX_AGE = 1 * 60 * 1000; // 1 phút

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ResponseMessage('Đăng nhập thành công')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // login() là hàm async -> phải await để lấy giá trị Tokens bên trong Promise
    const { accessToken, refreshToken, profile } =
      await this.authService.login(loginDto);
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_MAX_AGE });
    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
    // Token nằm trong cookie httpOnly, body chỉ trả thông tin người dùng + quyền
    return profile;
  }

  // @Public: access token có thể đã hết hạn, chỉ cần refresh token (RefreshTokenGuard kiểm tra)
  @Public()
  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @ResponseMessage('Làm mới phiên thành công')
  async refresh(
    @Req() req: Request & { user: RefreshUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, jti } = req.user;
    const { accessToken } = await this.authService.refreshToken(userId, jti);
    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_MAX_AGE });
    return null;
  }

  // Không gắn @RequirePermissions: ai đăng nhập cũng xem được thông tin của chính mình
  @Get('me')
  @ResponseMessage('Lấy thông tin phiên thành công')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId);
  }

  @Public()
  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  @ResponseMessage('Đăng xuất thành công')
  async logout(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request & { user: RefreshUser },
  ) {
    const { userId, jti } = req.user;
    await this.authService.logout(userId, jti);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    res.clearCookie('accessToken', COOKIE_OPTIONS);
    return null;
  }
}

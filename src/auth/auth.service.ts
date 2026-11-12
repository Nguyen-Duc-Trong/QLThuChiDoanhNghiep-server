import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RoleKey, UserStatus, type Permission } from '../common/types.js';
import { handleServiceError } from '../common/handle-error.js';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service.js';
import { ConfigService } from '@nestjs/config';
import ms, { type StringValue } from 'ms';
import { RolesService } from '../roles/roles.service.js';
import type { AccessPayload } from './confirm_token/jwt.strategy.js';

interface payloadUsers {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  role: RoleKey;
}
interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Thông tin phiên trả về cho client (POST /login và GET /me) */
export interface SessionProfile {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  role: RoleKey;
  roleName: string;
  scope: string;
  permissions: Permission[];
}

export const refreshSessionKey = (userId: string, jti: string) => `refresh_token:${userId}:${jti}`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly JwtService: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly rolesService: RolesService,
  ) {}

  // Access token mang theo role để guard biết vai trò mà không cần query DB.
  // Danh sách quyền KHÔNG nằm trong token: PermissionsGuard tra theo role (để sửa ma trận có hiệu lực ngay).
  private signAccessToken(user: payloadUsers): string {
    const payload: AccessPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    return this.JwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.getOrThrow<StringValue>('JWT_EXPIRES_IN'),
    });
  }

  private async createToken(user: payloadUsers): Promise<Tokens> {
    // StringValue: kiểu chuỗi thời gian của thư viện ms, vd "3600s", "7d"
    const refreshExpiresIn = this.config.getOrThrow<StringValue>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    // Redis cần TTL dạng số giây: "7d" -> 604800
    const refreshTtlSeconds = Math.floor(ms(refreshExpiresIn) / 1000);

    const jti = randomUUID();
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.JwtService.sign(
      { sub: user.id, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    await this.redis.setSession(refreshSessionKey(user.id, jti), jti, refreshTtlSeconds);

    return { accessToken, refreshToken };
  }

  private async buildProfile(user: payloadUsers): Promise<SessionProfile> {
    const role = await this.rolesService.findByKey(user.role);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      role: role.key,
      roleName: role.name,
      scope: role.scope,
      permissions: role.permissions,
    };
  }

  async login(loginDto: LoginDto): Promise<Tokens & { profile: SessionProfile }> {
    try {
      const { email, password } = loginDto;
      const user = await this.usersService.findByEmailWithPassword(email);

      // Sai email hay sai mật khẩu đều trả cùng một thông báo, tránh lộ email nào đã tồn tại
      const isMatch = user
        ? await bcrypt.compare(password, user.password)
        : false;
      if (!user || !isMatch) {
        throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException(
          'Tài khoản đã bị khóa hoặc không còn hoạt động',
        );
      }

      const { password: _password, ...result } = user;
      const tokens = await this.createToken(result);
      const profile = await this.buildProfile(result);
      return { ...tokens, profile };
    } catch (error) {
      handleServiceError(error, this.logger, 'login');
    }
  }

  async refreshToken(userId: string, jti: string): Promise<{ accessToken: string }> {
    try {
      const chekckJti = await this.redis.getSession(refreshSessionKey(userId, jti));
      if (!chekckJti) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }
      const user = await this.usersService.findByIdOrNull(userId);
      if (!user) {
        throw new UnauthorizedException('Người dùng không tồn tại');
      }
      // Tài khoản bị khóa sau khi đăng nhập -> không cấp access token mới, thu hồi phiên
      if (user.status !== UserStatus.ACTIVE) {
        await this.redis.deleteSession(refreshSessionKey(userId, jti));
        throw new ForbiddenException('Tài khoản đã bị khóa hoặc không còn hoạt động');
      }
      // Lấy role mới nhất từ DB: đổi vai trò cho user thì lần refresh sau có hiệu lực
      return { accessToken: this.signAccessToken(user) };
    } catch (error) {
      handleServiceError(error, this.logger, 'refreshToken');
    }
  }

  /** GET /me: thông tin người dùng + vai trò + quyền, client dùng để dựng menu/ẩn hiện nút */
  async me(userId: string): Promise<SessionProfile> {
    try {
      const user = await this.usersService.findByIdOrNull(userId);
      if (!user) {
        throw new UnauthorizedException('Người dùng không tồn tại');
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('Tài khoản đã bị khóa hoặc không còn hoạt động');
      }
      return await this.buildProfile(user);
    } catch (error) {
      handleServiceError(error, this.logger, 'me');
    }
  }

  async logout(userId: string, jti: string): Promise<void> {
    try {
      await this.redis.deleteSession(refreshSessionKey(userId, jti));
    } catch (error) {
      handleServiceError(error, this.logger, 'logout');
    }
  }
}

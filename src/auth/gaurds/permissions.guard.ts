import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesService } from '../../roles/roles.service.js';
import type { Permission } from '../../common/types.js';
import type { AuthUser } from '../confirm_token/jwt.strategy.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard GLOBAL, chạy SAU JwtAuthGuard (đã có req.user).
 * Route không gắn @RequirePermissions() → chỉ cần đăng nhập là được.
 * Route có gắn → vai trò phải có ĐỦ các quyền đó, thiếu thì 403.
 *
 * Quyền đọc theo vai trò từ DB (cache Redis), nên Admin sửa ma trận là có hiệu lực ngay,
 * không cần người dùng đăng nhập lại.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    const owned = await this.rolesService.getPermissions(user.role);
    if (!required.every((p) => owned.includes(p))) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../../permissions/permissions.service.js';
import type { Permission } from '../../common/types.js';
import type { AuthUser } from '../confirm_token/jwt.strategy.js';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard GLOBAL, chạy SAU JwtAuthGuard (đã có req.user).
 * Route không gắn @RequirePermissions / @RequireAnyPermission → chỉ cần đăng nhập là được.
 * - @RequirePermissions: phải có ĐỦ các quyền.
 * - @RequireAnyPermission: phải có ít nhất MỘT quyền.
 * Thiếu thì 403.
 *
 * Quyền hiệu lực (vai trò + cấp thêm − thu hồi riêng) đọc từ DB, có cache Redis,
 * nên Admin sửa ma trận hay quyền riêng là có hiệu lực ngay, không cần đăng nhập lại.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const all = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets) ?? [];
    const any = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, targets) ?? [];
    if (all.length === 0 && any.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    const owned = await this.permissionsService.getEffective(user.userId, user.role);
    const ok = all.every((p) => owned.includes(p)) && (any.length === 0 || any.some((p) => owned.includes(p)));
    if (!ok) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}

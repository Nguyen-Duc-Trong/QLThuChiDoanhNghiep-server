import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleKey } from '../common/types.js';
import { handleServiceError } from '../common/handle-error.js';
import { RedisService } from '../redis/redis.service.js';
import { RolesService } from '../roles/roles.service.js';
import { UsersService } from '../users/users.service.js';
import { OverrideEffect, UserPermissionOverride } from './entity/user-permission-override.entity.js';
import {
  ADMIN_REQUIRED_PERMISSIONS,
  PERMISSION_MODULES,
  SENSITIVE_PERMISSIONS,
  type Permission,
} from './permission-catalog.js';
import type { OverrideItemDto } from './dto/update-user-permissions.dto.js';

const CACHE_TTL_SECONDS = 60 * 60;
const USER_OVERRIDES_CACHE_KEY = (userId: string) => `user_overrides:${userId}`;

type OverrideRule = Pick<UserPermissionOverride, 'permission' | 'effect'>;

/** Quyền hiệu lực = quyền vai trò ∪ cấp thêm − thu hồi */
export function computeEffective(rolePermissions: Permission[], overrides: OverrideRule[]): Permission[] {
  const result = new Set(rolePermissions);
  for (const o of overrides) {
    if (o.effect === OverrideEffect.GRANT) result.add(o.permission);
    else result.delete(o.permission);
  }
  return [...result];
}

export interface UserPermissionsView {
  userId: string;
  role: RoleKey;
  rolePermissions: Permission[];
  overrides: Pick<UserPermissionOverride, 'permission' | 'effect' | 'reason' | 'updatedBy' | 'updatedAt'>[];
  effective: Permission[];
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(UserPermissionOverride)
    private readonly overridesRepository: Repository<UserPermissionOverride>,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
    private readonly redis: RedisService,
  ) {}

  /** Danh mục quyền cho client dựng màn phân quyền */
  getCatalog() {
    return PERMISSION_MODULES.map((m) => ({
      key: m.key,
      label: m.label,
      actions: m.actions.map((a) => ({
        key: a.key,
        label: a.label,
        defaultRoles: a.defaultRoles,
        sensitive: 'sensitive' in a ? a.sensitive : false,
        adminRequired: 'adminRequired' in a ? a.adminRequired : false,
      })),
    }));
  }

  /** Quyền hiệu lực của một người (dùng cho guard và GET /me) */
  async getEffective(userId: string, role: RoleKey): Promise<Permission[]> {
    const [rolePermissions, overrides] = await Promise.all([
      this.rolesService.getPermissions(role),
      this.getOverrideRules(userId),
    ]);
    return computeEffective(rolePermissions, overrides);
  }

  /** Ngoại lệ của một người: đọc Redis trước, không có mới đọc DB rồi lưu cache */
  private async getOverrideRules(userId: string): Promise<OverrideRule[]> {
    const cacheKey = USER_OVERRIDES_CACHE_KEY(userId);
    try {
      const cached = await this.redis.getSession(cacheKey);
      if (cached) return JSON.parse(cached) as OverrideRule[];
    } catch (error) {
      this.logger.warn(`Không đọc được cache quyền riêng: ${String(error)}`);
    }

    const rows = await this.overridesRepository.find({
      where: { userId },
      select: { permission: true, effect: true },
    });
    const rules = rows.map(({ permission, effect }) => ({ permission, effect }));
    try {
      await this.redis.setSession(cacheKey, JSON.stringify(rules), CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Không ghi được cache quyền riêng: ${String(error)}`);
    }
    return rules;
  }

  /** Chi tiết quyền của một người cho màn quản trị */
  async getUserPermissions(userId: string): Promise<UserPermissionsView> {
    try {
      const user = await this.usersService.findByIdOrNull(userId);
      if (!user) throw new NotFoundException('Không tìm thấy người dùng');

      const [rolePermissions, overrides] = await Promise.all([
        this.rolesService.getPermissions(user.role),
        this.overridesRepository.find({ where: { userId }, order: { permission: 'ASC' } }),
      ]);
      return {
        userId,
        role: user.role,
        rolePermissions,
        overrides: overrides.map(({ permission, effect, reason, updatedBy, updatedAt }) => ({
          permission,
          effect,
          reason,
          updatedBy,
          updatedAt,
        })),
        effective: computeEffective(rolePermissions, overrides),
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'getUserPermissions');
    }
  }

  /**
   * Thay toàn bộ ngoại lệ của một người.
   * - Không tự sửa quyền của chính mình.
   * - Người có vai trò ADMIN: không cấp quyền nhạy cảm, không thu hồi quyền quản trị bắt buộc.
   * - Ngoại lệ trùng với vai trò (cấp cái đã có / thu hồi cái không có) bị bỏ qua.
   */
  async setUserOverrides(userId: string, items: OverrideItemDto[], actorId: string): Promise<UserPermissionsView> {
    try {
      if (userId === actorId) {
        throw new BadRequestException('Không thể tự sửa quyền của chính mình');
      }
      const user = await this.usersService.findByIdOrNull(userId);
      if (!user) throw new NotFoundException('Không tìm thấy người dùng');

      const permissions = items.map((i) => i.permission);
      if (new Set(permissions).size !== permissions.length) {
        throw new BadRequestException('Mỗi quyền chỉ được khai báo một lần');
      }

      if (user.role === RoleKey.ADMIN) {
        if (items.some((i) => i.effect === OverrideEffect.GRANT && SENSITIVE_PERMISSIONS.includes(i.permission))) {
          throw new BadRequestException('Không được cấp quyền duyệt, thực chi hay ngân sách cho tài khoản Admin');
        }
        if (items.some((i) => i.effect === OverrideEffect.DENY && ADMIN_REQUIRED_PERMISSIONS.includes(i.permission))) {
          throw new BadRequestException('Không được thu hồi quyền quản trị bắt buộc của tài khoản Admin');
        }
      }

      const rolePermissions = await this.rolesService.getPermissions(user.role);
      const meaningful = items.filter((i) =>
        i.effect === OverrideEffect.GRANT ? !rolePermissions.includes(i.permission) : rolePermissions.includes(i.permission),
      );

      await this.overridesRepository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(UserPermissionOverride);
        await repo.delete({ userId });
        if (meaningful.length > 0) {
          await repo.save(
            meaningful.map((i) =>
              repo.create({
                userId,
                permission: i.permission,
                effect: i.effect,
                reason: i.reason?.trim() || null,
                updatedBy: actorId,
              }),
            ),
          );
        }
      });
      await this.redis.deleteSession(USER_OVERRIDES_CACHE_KEY(userId));
      return await this.getUserPermissions(userId);
    } catch (error) {
      handleServiceError(error, this.logger, 'setUserOverrides');
    }
  }

  /** Số ngoại lệ theo từng người (để màn danh sách người dùng gắn nhãn "Có quyền riêng") */
  async countOverridesByUser(): Promise<Record<string, number>> {
    try {
      const rows = await this.overridesRepository
        .createQueryBuilder('o')
        .select('o.userId', 'userId')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('o.userId')
        .getRawMany<{ userId: string; count: number }>();
      return Object.fromEntries(rows.map((r) => [r.userId, r.count]));
    } catch (error) {
      handleServiceError(error, this.logger, 'countOverridesByUser');
    }
  }
}

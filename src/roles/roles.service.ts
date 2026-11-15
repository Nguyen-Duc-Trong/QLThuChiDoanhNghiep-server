import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entity/role.entity.js';
import { SeededPermission } from './entity/seeded-permission.entity.js';
import { RoleKey } from '../common/types.js';
import { RedisService } from '../redis/redis.service.js';
import { handleServiceError } from '../common/handle-error.js';
import { DEFAULT_ROLES, ROLE_PERMISSIONS_CACHE_KEY } from './roles.constants.js';
import {
  ADMIN_REQUIRED_PERMISSIONS,
  ALL_PERMISSIONS,
  LEGACY_PERMISSION_MAP,
  SENSITIVE_PERMISSIONS,
  defaultPermissionsOf,
  defaultRolesOf,
  isPermission,
  type Permission,
} from '../permissions/permission-catalog.js';

// Cache quyền theo vai trò trong Redis để guard không phải query DB ở mỗi request
const CACHE_TTL_SECONDS = 60 * 60;

// Quyền mới sinh ra từ key kiểu cũ: vai trò vừa được chuyển dữ liệu thì giữ nguyên kết quả chuyển, không cấp mặc định đè lên
const LEGACY_SOURCED = new Set<Permission>(Object.values(LEGACY_PERMISSION_MAP).flat());

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
    @InjectRepository(SeededPermission) private readonly seededRepository: Repository<SeededPermission>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Khi khởi động:
   *  1. Chuyển key quyền kiểu cũ (view, create, menuIncome...) sang key theo module.
   *  2. Tạo vai trò hệ thống còn thiếu (quyền mặc định theo catalog).
   *  3. Quyền mới thêm vào catalog (chưa có trong SeededPermissions) → cấp cho vai trò mặc định, đúng một lần.
   * Không ghi đè những gì Admin đã chỉnh.
   */
  async onModuleInit(): Promise<void> {
    const existing = await this.rolesRepository.find();
    const changed = new Set<Role>();

    const migrated = new Set<RoleKey>();
    for (const role of existing) {
      if (this.migrateLegacy(role)) {
        migrated.add(role.key);
        changed.add(role);
      }
    }
    if (migrated.size > 0) {
      this.logger.log(`Đã chuyển quyền kiểu cũ sang quyền theo module: ${[...migrated].join(', ')}`);
    }

    const existingKeys = new Set(existing.map((r) => r.key));
    const missing = DEFAULT_ROLES.filter((r) => !existingKeys.has(r.key));
    if (missing.length > 0) {
      await this.rolesRepository.save(missing.map((r) => this.rolesRepository.create(r)));
      this.logger.log(`Đã tạo vai trò mặc định: ${missing.map((r) => r.key).join(', ')}`);
    }

    const seeded = new Set((await this.seededRepository.find()).map((s) => s.key));
    const newKeys = ALL_PERMISSIONS.filter((key) => !seeded.has(key));
    for (const key of newKeys) {
      for (const role of existing) {
        if (migrated.has(role.key) && LEGACY_SOURCED.has(key)) continue;
        if (defaultRolesOf(key).includes(role.key) && !role.permissions.includes(key)) {
          role.permissions = [...role.permissions, key];
          changed.add(role);
        }
      }
    }
    if (newKeys.length > 0) {
      await this.seededRepository.save(newKeys.map((key) => this.seededRepository.create({ key })));
      this.logger.log(`Đã đăng ký quyền mới: ${newKeys.join(', ')}`);
    }

    if (changed.size > 0) {
      await this.rolesRepository.save([...changed]);
      try {
        await this.redis.deleteByPattern(ROLE_PERMISSIONS_CACHE_KEY('*' as RoleKey));
      } catch (error) {
        this.logger.warn(`Không xoá được cache quyền: ${String(error)}`);
      }
    }
  }

  /** Đổi key kiểu cũ của một vai trò sang key mới. Trả về true nếu có thay đổi. */
  private migrateLegacy(role: Role): boolean {
    const current = role.permissions as string[];
    const legacy = current.filter((p) => !isPermission(p));
    if (legacy.length === 0) return false;

    const next = new Set<Permission>(current.filter(isPermission));
    for (const old of legacy) {
      for (const p of LEGACY_PERMISSION_MAP[old] ?? []) next.add(p);
    }
    // Dữ liệu từ trước khi có quyền menu: cấp menu mặc định của vai trò để không mất sidebar
    if (!legacy.some((p) => p.startsWith('menu'))) {
      defaultPermissionsOf(role.key)
        .filter((p) => p.endsWith('.menu'))
        .forEach((p) => next.add(p));
    }
    role.permissions = this.enforceRoleRules(role.key, [...next]);
    return true;
  }

  /** Ràng buộc cố định của vai trò ADMIN: bỏ quyền nhạy cảm, luôn giữ quyền quản trị bắt buộc */
  private enforceRoleRules(key: RoleKey, permissions: Permission[]): Permission[] {
    if (key !== RoleKey.ADMIN) return permissions;
    const allowed = permissions.filter((p) => !SENSITIVE_PERMISSIONS.includes(p));
    return [...new Set([...allowed, ...ADMIN_REQUIRED_PERMISSIONS])];
  }

  async findAll(): Promise<Role[]> {
    try {
      const roles = await this.rolesRepository.find();
      const order = DEFAULT_ROLES.map((r) => r.key);
      return roles.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    } catch (error) {
      handleServiceError(error, this.logger, 'findAll');
    }
  }

  async findByKey(key: RoleKey): Promise<Role> {
    try {
      const role = await this.rolesRepository.findOne({ where: { key } });
      if (!role) {
        throw new NotFoundException('Không tìm thấy vai trò');
      }
      return role;
    } catch (error) {
      handleServiceError(error, this.logger, 'findByKey');
    }
  }

  /** Quyền của một vai trò: đọc Redis trước, không có mới đọc DB rồi lưu lại cache */
  async getPermissions(key: RoleKey): Promise<Permission[]> {
    const cacheKey = ROLE_PERMISSIONS_CACHE_KEY(key);
    try {
      const cached = await this.redis.getSession(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Permission[];
      }
    } catch (error) {
      // Redis lỗi thì vẫn đọc DB, không chặn người dùng
      this.logger.warn(`Không đọc được cache quyền: ${String(error)}`);
    }

    const role = await this.rolesRepository.findOne({ where: { key } });
    const permissions = role?.permissions ?? [];
    try {
      await this.redis.setSession(cacheKey, JSON.stringify(permissions), CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Không ghi được cache quyền: ${String(error)}`);
    }
    return permissions;
  }

  /** Sửa một hàng của ma trận phân quyền */
  async updatePermissions(key: RoleKey, permissions: Permission[]): Promise<Role> {
    try {
      const role = await this.findByKey(key);
      const unique = [...new Set(permissions)];

      if (key === RoleKey.ADMIN) {
        if (unique.some((p) => SENSITIVE_PERMISSIONS.includes(p))) {
          throw new BadRequestException(
            'Admin chỉ quản trị cấu hình, không được cấp quyền duyệt, thực chi hay ngân sách',
          );
        }
        if (!ADMIN_REQUIRED_PERMISSIONS.every((p) => unique.includes(p))) {
          throw new BadRequestException(
            'Không được bỏ quyền Xem menu / Người dùng / Vai trò & phân quyền của Admin, nếu không sẽ không ai vào được màn quản trị',
          );
        }
      }

      role.permissions = unique;
      const saved = await this.rolesRepository.save(role);
      // Xoá cache để thay đổi có hiệu lực ngay ở request tiếp theo
      await this.redis.deleteSession(ROLE_PERMISSIONS_CACHE_KEY(key));
      return saved;
    } catch (error) {
      handleServiceError(error, this.logger, 'updatePermissions');
    }
  }
}

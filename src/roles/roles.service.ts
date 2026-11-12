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
import { Permission, RoleKey, SENSITIVE_PERMISSIONS } from '../common/types.js';
import { RedisService } from '../redis/redis.service.js';
import { handleServiceError } from '../common/handle-error.js';
import {
  ADMIN_REQUIRED_PERMISSIONS,
  DEFAULT_ROLES,
  ROLE_PERMISSIONS_CACHE_KEY,
} from './roles.constants.js';

// Cache quyền theo vai trò trong Redis để guard không phải query DB ở mỗi request
const CACHE_TTL_SECONDS = 60 * 60;

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
    private readonly redis: RedisService,
  ) {}

  /** Lần đầu chạy: tạo 5 vai trò mặc định nếu DB chưa có (không ghi đè vai trò đã sửa) */
  async onModuleInit(): Promise<void> {
    const existing = await this.rolesRepository.find({ select: { key: true } });
    const existingKeys = new Set(existing.map((r) => r.key));
    const missing = DEFAULT_ROLES.filter((r) => !existingKeys.has(r.key));
    if (missing.length > 0) {
      await this.rolesRepository.save(missing.map((r) => this.rolesRepository.create(r)));
      this.logger.log(`Đã tạo vai trò mặc định: ${missing.map((r) => r.key).join(', ')}`);
    }
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
        const sensitive = unique.filter((p) => SENSITIVE_PERMISSIONS.includes(p));
        if (sensitive.length > 0) {
          throw new BadRequestException(
            'Admin chỉ quản trị cấu hình, không được cấp quyền duyệt, thực chi hay ngân sách',
          );
        }
        if (!ADMIN_REQUIRED_PERMISSIONS.every((p) => unique.includes(p))) {
          throw new BadRequestException(
            'Không được bỏ quyền Người dùng / Cấu hình của Admin, nếu không sẽ không ai vào được màn quản trị',
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

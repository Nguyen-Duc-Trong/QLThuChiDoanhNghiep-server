import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository.js';
import { CreateUsersDto } from './dto/create-users.dto.js';
import { Users } from './entity/users.entity.js';
import { RoleKey, UserStatus } from '../common/types.js';
import { PaginatedResult, paginate } from '../common/response.js';
import { handleServiceError } from '../common/handle-error.js';
import { ListUsersQueryDto } from './dto/list-users.dto.js';
import { RedisService } from '../redis/redis.service.js';

const SALT_ROUNDS = 10;

// Tài khoản demo tạo lần đầu (khi DB chưa có ADMIN nào), mật khẩu mặc định 123456.
// Email khớp DEMO_USERS ở client/src/mocks/data.js để dễ đăng nhập thử từng vai trò.
const DEMO_PASSWORD = '123456';
const DEMO_ACCOUNTS: { username: string; email: string; role: RoleKey }[] = [
  { username: 'Quản trị hệ thống', email: 'admin@anviet.vn', role: RoleKey.ADMIN },
  { username: 'Nguyễn Mai Anh', email: 'maianh@anviet.vn', role: RoleKey.NHAN_VIEN },
  { username: 'Trần Minh Đức', email: 'minhduc@anviet.vn', role: RoleKey.TRUONG_PHONG },
  { username: 'Lê Thu Hà', email: 'thuha@anviet.vn', role: RoleKey.KE_TOAN },
  { username: 'Phạm Quốc Huy', email: 'quochuy@anviet.vn', role: RoleKey.LANH_DAO },
];

type PublicUser = Omit<Users, 'password'>;

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly redis: RedisService,
  ) {}

  /** Chưa có ADMIN nào -> tạo tài khoản demo, tránh bị khoá ngoài màn quản trị khi DB trống */
  async onApplicationBootstrap(): Promise<void> {
    if (await this.usersRepository.existsByRole(RoleKey.ADMIN)) return;
    const password = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
    const created: string[] = [];
    for (const account of DEMO_ACCOUNTS) {
      const user = await this.usersRepository.createUser({ ...account, password, status: UserStatus.ACTIVE });
      if (user) created.push(`${account.email} (${account.role})`);
    }
    if (created.length > 0) {
      this.logger.warn(`Đã tạo tài khoản demo, mật khẩu "${DEMO_PASSWORD}": ${created.join(', ')}. Hãy đổi mật khẩu khi triển khai thật.`);
    }
  }

  // Chỉ trả về dữ liệu; ResponseInterceptor sẽ tự bọc thành { success, statusCode, message, data, ... }
  async createUser(
    user: CreateUsersDto,
  ): Promise<Omit<Users, 'password' | 'id'>> {
    try {
      const userData = {
        username: user.username,
        email: user.email,
        password: await this.hashPassword(user.password),
        status: UserStatus.ACTIVE,
        role: user.role ?? RoleKey.NHAN_VIEN,
      };
      const newUser = await this.usersRepository.createUser(userData);
      if (!newUser) {
        // HttpExceptionFilter sẽ trả về { success: false, statusCode: 409, message: 'Email đã tồn tại', ... }
        throw new ConflictException('Email đã tồn tại');
      }
      // Không trả mật khẩu và ID về cho client
      const { password, id, ...result } = newUser;
      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'createUser');
    }
  }

  /**
   * actorId: người đang thao tác. Không cho tự khoá / tự đổi vai trò của chính mình
   * (tránh Admin tự đá mình ra khỏi màn quản trị).
   */
  async updateUser(
    user: Partial<Users>,
    actorId?: string,
  ): Promise<Omit<Users, 'password' | 'id'> | null> {
    try {
      if (!user.id) {
        throw new ConflictException('ID người dùng không được để trống');
      }
      const current = await this.usersRepository.findById(user.id);
      if (!current) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }
      const lockingOut = user.status !== undefined && user.status !== UserStatus.ACTIVE;
      const changingRole = user.role !== undefined && user.role !== current.role;
      if (actorId === user.id && (lockingOut || changingRole)) {
        throw new BadRequestException('Không thể tự khóa hoặc tự đổi vai trò của chính mình');
      }
      if (
        user.email &&
        (await this.usersRepository.existsEmail(user.email, user.id))
      ) {
        throw new ConflictException('Email đã tồn tại');
      }
      // Có gửi mật khẩu mới thì hash trước khi lưu; bỏ trống thì giữ nguyên
      if (user.password) {
        user.password = await this.hashPassword(user.password);
      }
      const updatedUser = await this.usersRepository.updateUser(user.id, user);
      if (!updatedUser) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }
      // Khoá tài khoản / đổi mật khẩu -> thu hồi mọi phiên đăng nhập đang có
      if (lockingOut || user.password) {
        await this.revokeSessions(user.id);
      }
      const { password, id, ...result } = updatedUser;
      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'updateUser');
    }
  }

  async findAll(
    query: ListUsersQueryDto,
  ): Promise<PaginatedResult<PublicUser>> {
    try {
      const { page, limit, search, status, role } = query;
      const [items, total] = await this.usersRepository.findAll({
        page,
        limit,
        search,
        status,
        role,
      });
      return paginate(items, total, page, limit);
    } catch (error) {
      handleServiceError(error, this.logger, 'findAll');
    }
  }

  async findById(id: string): Promise<PublicUser | null> {
    try {
      const user = await this.usersRepository.findById(id);
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }
      const { password, ...result } = user;
      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'findById');
    }
  }

  /** Như findById nhưng không ném 404 — dùng nội bộ cho AuthService */
  async findByIdOrNull(id: string): Promise<PublicUser | null> {
    try {
      const user = await this.usersRepository.findById(id);
      if (!user) return null;
      const { password, ...result } = user;
      return result;
    } catch (error) {
      handleServiceError(error, this.logger, 'findByIdOrNull');
    }
  }

  async deleteUsers(
    ids: string[],
    actorId?: string,
  ): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    try {
      const uniqueIds = [...new Set(ids)];
      if (actorId && uniqueIds.includes(actorId)) {
        throw new BadRequestException('Không thể tự xóa tài khoản của chính mình');
      }
      const existing = await this.usersRepository.findByIds(uniqueIds);
      const existingIds = existing.map((u) => u.id);
      if (existingIds.length === 0) {
        throw new NotFoundException('Không tìm thấy người dùng cần xóa');
      }
      await this.usersRepository.deleteUsers(existingIds);
      await Promise.all(existingIds.map((id) => this.revokeSessions(id)));
      const notFoundIds = uniqueIds.filter((id) => !existingIds.includes(id));
      return { deletedIds: existingIds, notFoundIds };
    } catch (error) {
      handleServiceError(error, this.logger, 'deleteUsers');
    }
  }

  async existsEmail(email: string): Promise<boolean> {
    try {
      return await this.usersRepository.existsEmail(email);
    } catch (error) {
      handleServiceError(error, this.logger, 'existsEmail');
    }
  }

  // Kiểm tra mật khẩu của user đã biết id (vd: đổi mật khẩu). Không dùng cho đăng nhập.
  async checkPassword(userId: string, password: string): Promise<boolean> {
    try {
      const user = await this.usersRepository.findById(userId);
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }
      return await bcrypt.compare(password, user.password);
    } catch (error) {
      handleServiceError(error, this.logger, 'checkPassword');
    }
  }

  // Tìm user theo email, trả về cả mật khẩu đã hash — chỉ dùng nội bộ (AuthService)
  async findByEmailWithPassword(email: string): Promise<Users | null> {
    try {
      return await this.usersRepository.findByEmail(email);
    } catch (error) {
      handleServiceError(error, this.logger, 'findByEmailWithPassword');
    }
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, SALT_ROUNDS);
    } catch (error) {
      handleServiceError(error, this.logger, 'hashPassword');
    }
  }

  // Xoá mọi refresh token của user trong Redis -> lần refresh tiếp theo bị từ chối
  private async revokeSessions(userId: string): Promise<void> {
    await this.redis.deleteByPattern(`refresh_token:${userId}:*`);
  }
}

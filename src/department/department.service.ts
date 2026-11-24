import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { handleServiceError } from '../common/handle-error.js';
import { RoleKey, UserStatus } from '../common/types.js';
import { Users } from '../users/entity/users.entity.js';
import { BudgetLine } from '../budgets/entity/budget-line.entity.js';
import { Project } from '../budgets/entity/project.entity.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';
import { Department } from './entity/department.entity.js';

export enum DepartmentConfigStatus {
  HOAN_THIEN = 'HOAN_THIEN',
  THIEU_NGUOI_DUYET = 'THIEU_NGUOI_DUYET',
}

export type DepartmentView = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  headId: string | null;
  headName: string | null;
  approverId: string | null;
  approverName: string | null;
  memberCount: number;
  // Thiếu trưởng phòng hoặc người phụ trách duyệt → hồ sơ chi của phòng có thể bị kẹt ở bước duyệt phòng
  status: DepartmentConfigStatus;
  missing: string[];
  createdAt: Date;
  updatedAt: Date;
};

/** Người dùng chọn được làm trưởng phòng / người duyệt / người ủy quyền */
export type StaffOption = {
  id: string;
  username: string;
  email: string;
  role: RoleKey;
  departmentId: string | null;
};

/** Tài khoản đang hoạt động (status null là dữ liệu cũ, coi như hoạt động) */
export const isActiveUser = (user: Pick<Users, 'status'>) =>
  user.status !== UserStatus.DELETED && user.status !== UserStatus.INACTIVE;

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    @InjectRepository(Department)
    private readonly departmentsRepository: Repository<Department>,
  ) {}

  /** GET /departments: toàn bộ phòng ban (số lượng nhỏ, không phân trang) */
  async findAll(): Promise<DepartmentView[]> {
    try {
      const departments = await this.departmentsRepository.find({ order: { name: 'ASC' } });
      return await this.toViews(departments);
    } catch (error) {
      handleServiceError(error, this.logger, 'findAll');
    }
  }

  async findOne(id: string): Promise<DepartmentView> {
    try {
      const department = await this.departmentsRepository.findOneBy({ id });
      if (!department) throw new NotFoundException('Không tìm thấy phòng ban');
      return (await this.toViews([department]))[0];
    } catch (error) {
      handleServiceError(error, this.logger, 'findOne');
    }
  }

  /** GET /departments/form-options: người dùng đang hoạt động để chọn trưởng phòng / người duyệt */
  async getStaffOptions(): Promise<StaffOption[]> {
    try {
      const users = await this.departmentsRepository.manager.getRepository(Users).find({
        where: { role: Not(RoleKey.ADMIN) },
        select: { id: true, username: true, email: true, role: true, departmentId: true, status: true },
        order: { username: 'ASC' },
      });
      return users.filter(isActiveUser).map(({ id, username, email, role, departmentId }) => ({
        id,
        username,
        email,
        role,
        departmentId,
      }));
    } catch (error) {
      handleServiceError(error, this.logger, 'getStaffOptions');
    }
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentView> {
    try {
      await this.assertUnique(dto.code, dto.name);
      const department = this.departmentsRepository.create({
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
        headId: dto.headId ?? null,
        approverId: dto.approverId ?? null,
      });
      await this.validateApprovers(department, this.departmentsRepository.manager);
      const saved = await this.departmentsRepository.save(department);
      return await this.findOne(saved.id);
    } catch (error) {
      handleServiceError(error, this.logger, 'create');
    }
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentView> {
    try {
      const department = await this.departmentsRepository.findOneBy({ id });
      if (!department) throw new NotFoundException('Không tìm thấy phòng ban');

      const codeChanged = dto.code !== undefined && dto.code !== department.code;
      const nameChanged = dto.name !== undefined && dto.name.toLowerCase() !== department.name.toLowerCase();
      if (codeChanged || nameChanged) {
        await this.assertUnique(codeChanged ? dto.code! : null, nameChanged ? dto.name! : null, id);
      }

      if (dto.code !== undefined) department.code = dto.code;
      if (dto.name !== undefined) department.name = dto.name;
      if (dto.description !== undefined) department.description = dto.description || null;
      if (dto.headId !== undefined) department.headId = dto.headId;
      if (dto.approverId !== undefined) department.approverId = dto.approverId;
      await this.validateApprovers(department, this.departmentsRepository.manager);

      await this.departmentsRepository.save(department);
      return await this.findOne(id);
    } catch (error) {
      handleServiceError(error, this.logger, 'update');
    }
  }

  /** Chỉ xóa được phòng ban chưa có nhân sự / dự án / ngân sách / yêu cầu chi gắn vào */
  async remove(id: string): Promise<{ id: string }> {
    try {
      const department = await this.departmentsRepository.findOneBy({ id });
      if (!department) throw new NotFoundException('Không tìm thấy phòng ban');

      const manager = this.departmentsRepository.manager;
      const [members, projects, lines, expenses] = await Promise.all([
        manager
          .createQueryBuilder(Users, 'u')
          .where('u.departmentId = :id', { id })
          .andWhere('(u.status IS NULL OR u.status <> :deleted)', { deleted: UserStatus.DELETED })
          .getCount(),
        manager.countBy(Project, { departmentId: id }),
        manager.countBy(BudgetLine, { departmentId: id }),
        manager.countBy(ExpenseRequest, { departmentId: id }),
      ]);
      const usages = [
        members && `${members} nhân sự`,
        projects && `${projects} dự án`,
        lines && `${lines} dòng ngân sách`,
        expenses && `${expenses} yêu cầu chi`,
      ].filter(Boolean);
      if (usages.length > 0) {
        throw new ConflictException(`Không thể xóa ${department.name}: đang có ${usages.join(', ')}`);
      }

      // Ủy quyền theo phòng này bị xóa theo (ON DELETE CASCADE)
      await this.departmentsRepository.delete(id);
      return { id };
    } catch (error) {
      handleServiceError(error, this.logger, 'remove');
    }
  }

  // ---------------------------------------------------------------------------

  /** Mã (không phân biệt hoa thường) và tên không trùng phòng ban khác */
  private async assertUnique(code: string | null, name: string | null, excludeId?: string): Promise<void> {
    if (code) {
      const qb = this.departmentsRepository.createQueryBuilder('d').where('UPPER(d.code) = UPPER(:code)', { code });
      if (excludeId) qb.andWhere('d.id <> :excludeId', { excludeId });
      if (await qb.getExists()) throw new ConflictException(`Mã phòng ban ${code} đã tồn tại`);
    }
    if (name) {
      const qb = this.departmentsRepository.createQueryBuilder('d').where('LOWER(d.name) = LOWER(:name)', { name });
      if (excludeId) qb.andWhere('d.id <> :excludeId', { excludeId });
      if (await qb.getExists()) throw new ConflictException(`Tên phòng ban "${name}" đã tồn tại`);
    }
  }

  /**
   * Trưởng phòng / người phụ trách duyệt phải là tài khoản đang hoạt động, không phải ADMIN
   * (ADMIN không được cấp quyền duyệt). Người phụ trách duyệt được phép trùng trưởng phòng.
   */
  private async validateApprovers(department: Department, manager: EntityManager): Promise<void> {
    const ids = [department.headId, department.approverId].filter((v): v is string => Boolean(v));
    if (ids.length === 0) return;

    const users = await manager.find(Users, {
      where: { id: In(ids) },
      select: { id: true, username: true, role: true, status: true },
    });
    const check = (id: string | null, label: string) => {
      if (!id) return;
      const user = users.find((u) => u.id === id);
      if (!user || !isActiveUser(user)) throw new BadRequestException(`${label} không tồn tại hoặc đã bị khóa`);
      if (user.role === RoleKey.ADMIN) {
        throw new BadRequestException(`${label} không được là quản trị hệ thống (ADMIN không có quyền duyệt)`);
      }
    };
    check(department.headId, 'Trưởng phòng');
    check(department.approverId, 'Người phụ trách duyệt');
  }

  private async toViews(departments: Department[]): Promise<DepartmentView[]> {
    if (departments.length === 0) return [];
    const manager = this.departmentsRepository.manager;
    const departmentIds = departments.map((d) => d.id);
    const userIds = [
      ...new Set(departments.flatMap((d) => [d.headId, d.approverId]).filter((v): v is string => Boolean(v))),
    ];

    const [users, memberRows] = await Promise.all([
      userIds.length > 0
        ? manager.find(Users, { where: { id: In(userIds) }, select: { id: true, username: true } })
        : Promise.resolve([] as Users[]),
      manager
        .createQueryBuilder(Users, 'u')
        .select('u.departmentId', 'departmentId')
        .addSelect('COUNT(*)::int', 'count')
        .where('u.departmentId IN (:...departmentIds)', { departmentIds })
        .andWhere('(u.status IS NULL OR u.status <> :deleted)', { deleted: UserStatus.DELETED })
        .groupBy('u.departmentId')
        .getRawMany<{ departmentId: string; count: number }>(),
    ]);
    const names = new Map(users.map((u) => [u.id, u.username]));
    const members = new Map(memberRows.map((r) => [r.departmentId, Number(r.count)]));

    return departments.map((d) => {
      const missing = [!d.headId && 'Trưởng phòng', !d.approverId && 'Người phụ trách duyệt'].filter(
        (v): v is string => Boolean(v),
      );
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        description: d.description,
        headId: d.headId,
        headName: d.headId ? (names.get(d.headId) ?? null) : null,
        approverId: d.approverId,
        approverName: d.approverId ? (names.get(d.approverId) ?? null) : null,
        memberCount: members.get(d.id) ?? 0,
        status: missing.length > 0 ? DepartmentConfigStatus.THIEU_NGUOI_DUYET : DepartmentConfigStatus.HOAN_THIEN,
        missing,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { handleServiceError } from '../common/handle-error.js';
import { RoleKey } from '../common/types.js';
import { Users } from '../users/entity/users.entity.js';
import { isActiveUser } from './department.service.js';
import { CreateDelegationDto } from './dto/department.dto.js';
import { ApprovalDelegation } from './entity/approval-delegation.entity.js';
import { Department } from './entity/department.entity.js';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (so sánh được với cột date) */
const todayVN = () => new Date().toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });

export enum DelegationStatus {
  SAP_HIEU_LUC = 'SAP_HIEU_LUC',
  HIEU_LUC = 'HIEU_LUC',
  HET_HAN = 'HET_HAN',
  DA_THU_HOI = 'DA_THU_HOI',
}

export type DelegationView = {
  id: string;
  fromUserId: string;
  fromUserName: string | null;
  toUserId: string;
  toUserName: string | null;
  departmentId: string | null;
  // null = mọi phòng ban người ủy quyền phụ trách
  departmentName: string | null;
  maxAmount: number | null;
  startDate: string;
  endDate: string;
  note: string | null;
  status: DelegationStatus;
  revokedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class DelegationsService {
  private readonly logger = new Logger(DelegationsService.name);

  constructor(
    @InjectRepository(ApprovalDelegation)
    private readonly delegationsRepository: Repository<ApprovalDelegation>,
  ) {}

  /** GET /delegations: mới tạo lên đầu (giữ cả ủy quyền đã hết hạn / thu hồi làm lịch sử) */
  async findAll(): Promise<DelegationView[]> {
    try {
      const rows = await this.delegationsRepository.find({
        relations: { fromUser: true, toUser: true, department: true },
        order: { createdAt: 'DESC' },
        take: 200,
      });
      return rows.map((row) => this.toView(row));
    } catch (error) {
      handleServiceError(error, this.logger, 'findAll');
    }
  }

  async create(dto: CreateDelegationDto, actorId: string): Promise<DelegationView> {
    try {
      if (dto.fromUserId === dto.toUserId) {
        throw new BadRequestException('Người được ủy quyền phải khác người ủy quyền');
      }
      if (dto.endDate < dto.startDate) {
        throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
      }
      if (dto.endDate < todayVN()) {
        throw new BadRequestException('Ngày kết thúc không được ở quá khứ');
      }

      const manager = this.delegationsRepository.manager;
      const users = await manager.find(Users, {
        where: { id: In([dto.fromUserId, dto.toUserId]) },
        select: { id: true, username: true, role: true, status: true },
      });
      const from = users.find((u) => u.id === dto.fromUserId);
      const to = users.find((u) => u.id === dto.toUserId);
      if (!from || !isActiveUser(from)) throw new BadRequestException('Người ủy quyền không tồn tại hoặc đã bị khóa');
      if (!to || !isActiveUser(to)) throw new BadRequestException('Người được ủy quyền không tồn tại hoặc đã bị khóa');
      if (to.role === RoleKey.ADMIN) {
        throw new BadRequestException('Không thể ủy quyền duyệt cho quản trị hệ thống');
      }
      if (dto.departmentId && !(await manager.existsBy(Department, { id: dto.departmentId }))) {
        throw new BadRequestException('Phòng ban không tồn tại');
      }

      // Cùng người ủy quyền, khoảng ngày giao nhau, cùng phạm vi phòng ban (hoặc một bên là "mọi phòng") → trùng
      const overlapQuery = this.delegationsRepository
        .createQueryBuilder('d')
        .where('d.fromUserId = :fromUserId', { fromUserId: dto.fromUserId })
        .andWhere('d.revokedAt IS NULL')
        .andWhere('d.startDate <= :endDate AND d.endDate >= :startDate', {
          startDate: dto.startDate,
          endDate: dto.endDate,
        });
      // Ủy quyền mới cho "mọi phòng" giao với mọi ủy quyền còn hiệu lực của người này
      if (dto.departmentId) {
        overlapQuery.andWhere(
          new Brackets((qb) => {
            qb.where('d.departmentId IS NULL').orWhere('d.departmentId = :departmentId', {
              departmentId: dto.departmentId,
            });
          }),
        );
      }
      const overlap = await overlapQuery.getExists();
      if (overlap) {
        throw new ConflictException(
          `${from.username} đã có ủy quyền trùng thời gian và phạm vi. Thu hồi ủy quyền cũ trước khi tạo mới`,
        );
      }

      const saved = await this.delegationsRepository.save(
        this.delegationsRepository.create({
          fromUserId: dto.fromUserId,
          toUserId: dto.toUserId,
          departmentId: dto.departmentId ?? null,
          maxAmount: dto.maxAmount ?? null,
          startDate: dto.startDate,
          endDate: dto.endDate,
          note: dto.note || null,
          createdBy: actorId,
        }),
      );
      return await this.findOneView(saved.id);
    } catch (error) {
      handleServiceError(error, this.logger, 'create');
    }
  }

  /** DELETE /delegations/:id: thu hồi (giữ bản ghi làm lịch sử) */
  async revoke(id: string, actorId: string): Promise<DelegationView> {
    try {
      const delegation = await this.delegationsRepository.findOneBy({ id });
      if (!delegation) throw new NotFoundException('Không tìm thấy ủy quyền');
      if (delegation.revokedAt) throw new ConflictException('Ủy quyền này đã được thu hồi');
      if (delegation.endDate < todayVN()) throw new ConflictException('Ủy quyền này đã hết hạn');

      delegation.revokedAt = new Date();
      delegation.revokedBy = actorId;
      await this.delegationsRepository.save(delegation);
      return await this.findOneView(id);
    } catch (error) {
      handleServiceError(error, this.logger, 'revoke');
    }
  }

  /**
   * Người đang được ủy quyền duyệt thay `fromUserId` cho hồ sơ của `departmentId` với số tiền `amount`
   * vào hôm nay. Dùng cho luồng phê duyệt (người duyệt vắng mặt / không được tự duyệt). Không có → null.
   */
  async findActiveDelegate(fromUserId: string, departmentId: string, amount: number): Promise<string | null> {
    const today = todayVN();
    const candidates = await this.delegationsRepository.find({
      where: [
        { fromUserId, departmentId, revokedAt: IsNull(), startDate: LessThanOrEqual(today), endDate: MoreThanOrEqual(today) },
        { fromUserId, departmentId: IsNull(), revokedAt: IsNull(), startDate: LessThanOrEqual(today), endDate: MoreThanOrEqual(today) },
      ],
      order: { createdAt: 'DESC' },
    });
    const match = candidates.find((d) => d.maxAmount === null || amount <= d.maxAmount);
    return match?.toUserId ?? null;
  }

  // ---------------------------------------------------------------------------

  private async findOneView(id: string): Promise<DelegationView> {
    const row = await this.delegationsRepository.findOneOrFail({
      where: { id },
      relations: { fromUser: true, toUser: true, department: true },
    });
    return this.toView(row);
  }

  private toView(row: ApprovalDelegation): DelegationView {
    const today = todayVN();
    const status = row.revokedAt
      ? DelegationStatus.DA_THU_HOI
      : row.startDate > today
        ? DelegationStatus.SAP_HIEU_LUC
        : row.endDate < today
          ? DelegationStatus.HET_HAN
          : DelegationStatus.HIEU_LUC;
    return {
      id: row.id,
      fromUserId: row.fromUserId,
      fromUserName: row.fromUser?.username ?? null,
      toUserId: row.toUserId,
      toUserName: row.toUser?.username ?? null,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      maxAmount: row.maxAmount,
      startDate: row.startDate,
      endDate: row.endDate,
      note: row.note,
      status,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }
}

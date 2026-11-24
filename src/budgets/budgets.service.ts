import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { handleServiceError } from '../common/handle-error.js';
import {
  BudgetPeriodStatus,
  CategoryStatus,
  CategoryType,
  COMMITTED_EXPENSE_STATUSES,
  ExpenseStatus,
} from '../common/types.js';
import { Categories } from '../categories/entity/categories.entity.js';
import { Department } from '../department/entity/department.entity.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { BudgetLine } from './entity/budget-line.entity.js';
import { BudgetPeriod } from './entity/budget-period.entity.js';
import { Project } from './entity/project.entity.js';
import {
  CreateBudgetLineDto,
  CreateBudgetPeriodDto,
  CreateProjectDto,
  ListBudgetLinesQueryDto,
  ListBudgetPeriodsQueryDto,
  ListProjectsQueryDto,
} from './dto/budgets.dto.js';

/** Số đã dùng của một dòng ngân sách */
export interface BudgetUsage {
  spent: number;
  committed: number;
}

/** Một dòng ngân sách kèm số liệu sử dụng, dạng client hiển thị */
export interface BudgetLineView {
  id: string;
  periodId: string;
  periodName: string;
  periodStatus: BudgetPeriodStatus;
  departmentId: string;
  departmentName: string;
  categoryId: string;
  categoryName: string;
  name: string;
  /** vd "Phòng Phát triển / Mua thiết bị" */
  label: string;
  plannedAmount: number;
  spentAmount: number;
  committedAmount: number;
  /** Khả dụng = kế hoạch − đã chi − cam kết */
  availableAmount: number;
}

// Yêu cầu chi đã kết thúc mà không chi thì không tính vào ngân sách
const INACTIVE_EXPENSE_STATUSES = [ExpenseStatus.TU_CHOI, ExpenseStatus.HUY];

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    @InjectRepository(Project) private readonly projectsRepository: Repository<Project>,
    @InjectRepository(BudgetPeriod) private readonly periodsRepository: Repository<BudgetPeriod>,
    @InjectRepository(BudgetLine) private readonly linesRepository: Repository<BudgetLine>,
  ) {}

  // ---------------------------------------------------------------------------
  // Dự án
  // ---------------------------------------------------------------------------
  async listProjects(query: ListProjectsQueryDto): Promise<Project[]> {
    try {
      return await this.projectsRepository.find({
        where: query.status ? { status: query.status } : {},
        order: { code: 'ASC' },
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'listProjects');
    }
  }

  async createProject(dto: CreateProjectDto): Promise<Project> {
    try {
      if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
      }
      if (await this.projectsRepository.existsBy({ code: dto.code })) {
        throw new ConflictException(`Mã dự án ${dto.code} đã tồn tại`);
      }
      if (dto.departmentId) await this.findDepartmentOrFail(dto.departmentId);
      const project = this.projectsRepository.create({
        code: dto.code,
        name: dto.name,
        departmentId: dto.departmentId ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        ...(dto.status && { status: dto.status }),
      });
      return await this.projectsRepository.save(project);
    } catch (error) {
      handleServiceError(error, this.logger, 'createProject');
    }
  }

  // ---------------------------------------------------------------------------
  // Kỳ ngân sách
  // ---------------------------------------------------------------------------
  async listPeriods(query: ListBudgetPeriodsQueryDto): Promise<BudgetPeriod[]> {
    try {
      return await this.periodsRepository.find({
        where: query.status ? { status: query.status } : {},
        order: { startDate: 'ASC' },
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'listPeriods');
    }
  }

  async createPeriod(dto: CreateBudgetPeriodDto): Promise<BudgetPeriod> {
    try {
      if (dto.endDate < dto.startDate) {
        throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
      }
      if (await this.periodsRepository.existsBy({ code: dto.code })) {
        throw new ConflictException(`Mã kỳ ${dto.code} đã tồn tại`);
      }
      const period = this.periodsRepository.create({
        code: dto.code,
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        totalLimit: dto.totalLimit,
        ...(dto.warningThreshold !== undefined && { warningThreshold: dto.warningThreshold }),
        ...(dto.status && { status: dto.status }),
      });
      return await this.periodsRepository.save(period);
    } catch (error) {
      handleServiceError(error, this.logger, 'createPeriod');
    }
  }

  // ---------------------------------------------------------------------------
  // Dòng ngân sách
  // ---------------------------------------------------------------------------
  async listLines(query: ListBudgetLinesQueryDto): Promise<BudgetLineView[]> {
    try {
      const lines = await this.linesRepository.find({
        where: {
          ...(query.periodId && { periodId: query.periodId }),
          ...(query.departmentId && { departmentId: query.departmentId }),
          ...(query.categoryId && { categoryId: query.categoryId }),
        },
        relations: { period: true, department: true, category: true },
        order: { createdAt: 'ASC' },
      });
      return await this.toViews(lines);
    } catch (error) {
      handleServiceError(error, this.logger, 'listLines');
    }
  }

  /** Một dòng ngân sách kèm số liệu sử dụng; null nếu không có */
  async findLineView(id: string): Promise<BudgetLineView | null> {
    const line = await this.linesRepository.findOne({
      where: { id },
      relations: { period: true, department: true, category: true },
    });
    if (!line) return null;
    const [view] = await this.toViews([line]);
    return view;
  }

  async createLine(dto: CreateBudgetLineDto): Promise<BudgetLineView> {
    try {
      const period = await this.periodsRepository.findOneBy({ id: dto.periodId });
      if (!period) throw new NotFoundException('Không tìm thấy kỳ ngân sách');
      if (period.status === BudgetPeriodStatus.DONG) {
        throw new BadRequestException('Kỳ ngân sách đã đóng, không thêm được dòng mới');
      }
      await this.findDepartmentOrFail(dto.departmentId);

      const category = await this.linesRepository.manager.getRepository(Categories).findOneBy({ id: dto.categoryId });
      if (!category || category.type !== CategoryType.CHI) {
        throw new BadRequestException('Khoản mục phải là danh mục Chi');
      }
      if (category.status !== CategoryStatus.DANG_SU_DUNG) {
        throw new BadRequestException(`Danh mục "${category.name}" đã ngừng sử dụng`);
      }

      // Tổng kế hoạch các dòng trong kỳ không vượt tổng hạn mức của kỳ (0 = chưa đặt hạn mức)
      if (period.totalLimit > 0) {
        const { sum } = (await this.linesRepository
          .createQueryBuilder('l')
          .select('COALESCE(SUM(l.plannedAmount), 0)', 'sum')
          .where('l.periodId = :periodId', { periodId: period.id })
          .getRawOne<{ sum: string }>()) ?? { sum: '0' };
        const remaining = period.totalLimit - Number(sum);
        if (dto.plannedAmount > remaining) {
          throw new BadRequestException(
            `Vượt tổng hạn mức kỳ ${period.name}: chỉ còn ${remaining.toLocaleString('vi-VN')} VND chưa phân bổ`,
          );
        }
      }

      const name = dto.name ?? '';
      const duplicate = await this.linesRepository.existsBy({
        periodId: dto.periodId,
        departmentId: dto.departmentId,
        categoryId: dto.categoryId,
        name,
      });
      if (duplicate) throw new ConflictException('Dòng ngân sách này đã tồn tại trong kỳ');

      const saved = await this.linesRepository.save(
        this.linesRepository.create({
          periodId: dto.periodId,
          departmentId: dto.departmentId,
          categoryId: dto.categoryId,
          name,
          plannedAmount: dto.plannedAmount,
        }),
      );
      return (await this.findLineView(saved.id))!;
    } catch (error) {
      handleServiceError(error, this.logger, 'createLine');
    }
  }

  /**
   * Đã chi / cam kết của các dòng ngân sách, tính từ yêu cầu chi (một query cho cả danh sách).
   * - Đã chi   = tổng paidAmount của yêu cầu còn hiệu lực.
   * - Cam kết  = tổng (amount − paidAmount) của yêu cầu đã duyệt nhưng chưa chi hết.
   * excludeExpenseId: bỏ qua một yêu cầu (vd chính yêu cầu đang được kiểm tra).
   */
  async getUsage(lineIds: string[], excludeExpenseId?: string): Promise<Map<string, BudgetUsage>> {
    const usage = new Map<string, BudgetUsage>(lineIds.map((id) => [id, { spent: 0, committed: 0 }]));
    if (lineIds.length === 0) return usage;

    const qb = this.linesRepository.manager
      .getRepository(ExpenseRequest)
      .createQueryBuilder('e')
      .select('e.budgetLineId', 'lineId')
      .addSelect('COALESCE(SUM(e.paidAmount), 0)', 'spent')
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.status IN (:...committed) THEN e.amount - e.paidAmount ELSE 0 END), 0)`,
        'committed',
      )
      .where('e.budgetLineId IN (:...lineIds)', { lineIds })
      .andWhere({ status: Not(In(INACTIVE_EXPENSE_STATUSES)) })
      .setParameter('committed', COMMITTED_EXPENSE_STATUSES)
      .groupBy('e.budgetLineId');
    if (excludeExpenseId) qb.andWhere('e.id <> :excludeExpenseId', { excludeExpenseId });

    const rows = await qb.getRawMany<{ lineId: string; spent: string; committed: string }>();
    for (const row of rows) {
      usage.set(row.lineId, { spent: Number(row.spent), committed: Number(row.committed) });
    }
    return usage;
  }

  private async toViews(lines: BudgetLine[]): Promise<BudgetLineView[]> {
    const usage = await this.getUsage(lines.map((l) => l.id));
    return lines.map((line) => {
      const { spent, committed } = usage.get(line.id) ?? { spent: 0, committed: 0 };
      const itemName = line.name || line.category.name;
      return {
        id: line.id,
        periodId: line.periodId,
        periodName: line.period.name,
        periodStatus: line.period.status,
        departmentId: line.departmentId,
        departmentName: line.department.name,
        categoryId: line.categoryId,
        categoryName: line.category.name,
        name: line.name,
        label: `${line.department.name} / ${itemName}`,
        plannedAmount: line.plannedAmount,
        spentAmount: spent,
        committedAmount: committed,
        availableAmount: line.plannedAmount - spent - committed,
      };
    });
  }

  private async findDepartmentOrFail(id: string): Promise<Department> {
    const department = await this.linesRepository.manager.getRepository(Department).findOneBy({ id });
    if (!department) throw new NotFoundException('Không tìm thấy phòng ban');
    return department;
  }
}

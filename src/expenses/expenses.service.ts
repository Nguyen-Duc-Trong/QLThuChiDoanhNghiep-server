import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { handleServiceError } from '../common/handle-error.js';
import {
  BudgetPeriodStatus,
  CategoryStatus,
  CategoryType,
  EXPENSE_STATUS_LABEL,
  ExpenseStatus,
  PAYMENT_METHOD_LABEL,
  PaymentMethod,
  PENDING_EXPENSE_STATUSES,
  ProjectStatus,
} from '../common/types.js';
import { PaginatedResult, paginate } from '../common/response.js';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { Users } from '../users/entity/users.entity.js';
import { Department } from '../department/entity/department.entity.js';
import { Categories } from '../categories/entity/categories.entity.js';
import { Project } from '../budgets/entity/project.entity.js';
import { BudgetPeriod } from '../budgets/entity/budget-period.entity.js';
import { BudgetsService, type BudgetLineView } from '../budgets/budgets.service.js';
import { ExpenseRequest } from './entity/expense-request.entity.js';
import { SaveExpenseDto } from './dto/save-expense.dto.js';
import { ListExpensesQueryDto } from './dto/list-expenses.dto.js';
import { ExpenseRequestVersion, type ExpenseSnapshot } from './entity/expense-request-version.entity.js';
import {
  ApprovalWorkflowService,
  type ApprovalRecordView,
  type WorkflowInfo,
} from '../approvals/approval-workflow.service.js';
import { nextDocumentCode, todayVN } from '../common/document-code.js';
import { PaymentTransaction } from '../payments/entity/payment-transaction.entity.js';
import { toPaymentView, type PaymentView } from '../payments/payments.service.js';

/** Dữ liệu cho màn Tạo yêu cầu chi */
export interface ExpenseFormOptions {
  department: { id: string; name: string } | null;
  categories: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string }[];
  periods: { id: string; code: string; name: string; startDate: string; endDate: string }[];
  budgetLines: BudgetLineView[];
}

export type ExpenseView = Omit<ExpenseRequest, 'category' | 'project' | 'department' | 'budgetLine' | 'requester'> & {
  statusLabel: string;
  paymentMethodLabel: string;
  categoryName: string | null;
  projectName: string | null;
  departmentName: string | null;
  requesterName: string | null;
  budgetLine: BudgetLineView | null;
};

export interface ExpenseVersionView {
  version: number;
  submittedAt: Date;
  submittedByName: string | null;
  snapshot: ExpenseSnapshot;
}

/** Chi tiết hồ sơ (màn 10, 11–14): thêm lịch sử duyệt, phiên bản, bước đang chờ, thao tác được phép */
export type ExpenseDetailView = ExpenseView & {
  approvals: ApprovalRecordView[];
  versions: ExpenseVersionView[];
  workflow: WorkflowInfo;
  canEdit: boolean;
  canCancel: boolean;
  // Lệnh chi của kế toán (null khi chưa chi)
  payment: PaymentView | null;
};

/** Một dòng ở "Yêu cầu chi của tôi" */
export interface ExpenseListItem {
  id: string;
  code: string;
  purpose: string | null;
  amount: number | null;
  status: ExpenseStatus;
  statusLabel: string;
  dueDate: string | null;
  version: number;
  categoryName: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Thẻ thống kê màn 08: số hồ sơ + tổng tiền theo nhóm trạng thái */
export interface ExpenseStats {
  total: { count: number; amount: number };
  inReview: { count: number; amount: number };
  needChanges: { count: number; amount: number };
  paid: { count: number; amount: number };
}

// Người tạo được sửa / gửi / hủy khi hồ sơ là nháp hoặc bị yêu cầu bổ sung
const EDITABLE_STATUSES = [ExpenseStatus.NHAP, ExpenseStatus.CAN_BO_SUNG];

// Mã hiển thị, vd CHI-202611-0001: route chi tiết nhận cả id lẫn mã
const CODE_PATTERN = /^CHI-\d{6}-\d{4,}$/i;

// Trường được lưu thẳng từ DTO (undefined = không đổi, null = xóa giá trị)
const EDITABLE_FIELDS = [
  'purpose',
  'amount',
  'categoryId',
  'projectId',
  'budgetLineId',
  'dueDate',
  'beneficiaryName',
  'beneficiaryBankName',
  'beneficiaryAccountNumber',
  'paymentMethod',
  'note',
] as const satisfies readonly (keyof SaveExpenseDto & keyof ExpenseRequest)[];

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(ExpenseRequest)
    private readonly expensesRepository: Repository<ExpenseRequest>,
    private readonly budgetsService: BudgetsService,
    private readonly workflowService: ApprovalWorkflowService,
  ) {}

  /**
   * GET /expenses/form-options: phòng ban của người tạo + danh sách chọn (loại chi, dự án, kỳ đang mở)
   * + các dòng ngân sách của phòng trong kỳ đang mở, kèm số khả dụng.
   */
  async getFormOptions(actor: AuthUser): Promise<ExpenseFormOptions> {
    try {
      const manager = this.expensesRepository.manager;
      const department = await this.findActorDepartment(actor.userId);

      const [categories, projects, periods] = await Promise.all([
        manager.getRepository(Categories).find({
          where: { type: CategoryType.CHI, status: CategoryStatus.DANG_SU_DUNG },
          select: { id: true, code: true, name: true },
          order: { code: 'ASC' },
        }),
        manager.getRepository(Project).find({
          where: { status: ProjectStatus.DANG_CHAY },
          select: { id: true, code: true, name: true },
          order: { code: 'ASC' },
        }),
        manager.getRepository(BudgetPeriod).find({
          where: { status: BudgetPeriodStatus.MO },
          select: { id: true, code: true, name: true, startDate: true, endDate: true },
          order: { startDate: 'ASC' },
        }),
      ]);

      const budgetLines = department
        ? (await this.budgetsService.listLines({ departmentId: department.id })).filter(
            (line) => line.periodStatus === BudgetPeriodStatus.MO,
          )
        : [];

      return {
        department: department ? { id: department.id, name: department.name } : null,
        categories,
        projects,
        periods,
        budgetLines,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'getFormOptions');
    }
  }

  /** POST /expenses (nháp) và POST /expenses/submit (gửi luôn): cấp mã khi lưu lần đầu */
  async create(dto: SaveExpenseDto, actor: AuthUser, submit: boolean): Promise<ExpenseView> {
    try {
      const department = await this.findActorDepartment(actor.userId);
      if (!department) {
        throw new BadRequestException('Tài khoản chưa thuộc phòng ban nào, liên hệ quản trị viên để được gán phòng ban');
      }

      const id = await this.expensesRepository.manager.transaction(async (manager) => {
        const expense = manager.create(ExpenseRequest, {
          code: await nextDocumentCode(manager, 'CHI'),
          requesterId: actor.userId,
          departmentId: department.id,
          status: ExpenseStatus.NHAP,
        });
        this.applyChanges(expense, dto);
        await this.validateReferences(expense, manager);
        if (submit) await this.submitInPlace(expense);
        const saved = await manager.save(expense);
        if (submit) await this.afterSubmit(saved, manager, actor.userId);
        return saved.id;
      });
      return await this.findOneView(id);
    } catch (error) {
      handleServiceError(error, this.logger, 'create');
    }
  }

  /**
   * PATCH /expenses/:id (lưu) và POST /expenses/:id/submit (gửi): hồ sơ của chính mình, đang Nháp hoặc Cần bổ sung.
   * Gửi lại hồ sơ Cần bổ sung → phiên bản mới (v2, v3...) và quay về trưởng phòng duyệt từ đầu.
   */
  async update(id: string, dto: SaveExpenseDto, actor: AuthUser, submit: boolean): Promise<ExpenseView> {
    try {
      await this.expensesRepository.manager.transaction(async (manager) => {
        // Khóa dòng để hai lần bấm "Gửi" liên tiếp không cùng chuyển trạng thái
        const expense = await manager.findOne(ExpenseRequest, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!expense) throw new NotFoundException('Không tìm thấy yêu cầu chi');
        if (expense.requesterId !== actor.userId) {
          throw new ForbiddenException('Chỉ người tạo được sửa yêu cầu chi này');
        }
        if (!EDITABLE_STATUSES.includes(expense.status)) {
          throw new ConflictException(
            `Chỉ sửa được yêu cầu chi ở trạng thái Nháp hoặc Cần bổ sung (hiện tại: ${EXPENSE_STATUS_LABEL[expense.status]})`,
          );
        }
        const resubmit = submit && expense.status === ExpenseStatus.CAN_BO_SUNG;
        this.applyChanges(expense, dto);
        await this.validateReferences(expense, manager);
        if (submit) await this.submitInPlace(expense);
        if (resubmit) expense.version += 1;
        await manager.save(expense);
        if (submit) await this.afterSubmit(expense, manager, actor.userId);
      });
      return await this.findOneView(id);
    } catch (error) {
      handleServiceError(error, this.logger, 'update');
    }
  }

  /**
   * GET /expenses/:idOrCode (nhận id hoặc mã CHI-YYYYMM-XXXX).
   * Xem được: người tạo, người duyệt liên quan, kế toán / lãnh đạo (xem ApprovalWorkflowService.canView).
   */
  async findOne(idOrCode: string, actor: AuthUser): Promise<ExpenseDetailView> {
    try {
      const expense = await this.expensesRepository.findOne({
        where: CODE_PATTERN.test(idOrCode) ? { code: idOrCode.toUpperCase() } : { id: idOrCode },
      });
      if (!expense) throw new NotFoundException('Không tìm thấy yêu cầu chi');
      if (!(await this.workflowService.canView(expense, actor))) {
        throw new ForbiddenException('Bạn không có quyền xem yêu cầu chi này');
      }

      const isOwner = expense.requesterId === actor.userId;
      const [view, approvals, versions, workflow, payment] = await Promise.all([
        this.findOneView(expense.id),
        this.workflowService.listRecords(expense.id),
        this.listVersions(expense.id),
        this.workflowService.getWorkflowInfo(expense, actor.userId),
        this.expensesRepository.manager.findOne(PaymentTransaction, {
          where: { expenseId: expense.id },
          relations: { expense: { department: true }, executedBy: true },
        }),
      ]);
      return {
        ...view,
        approvals,
        versions,
        workflow,
        canEdit: isOwner && EDITABLE_STATUSES.includes(expense.status),
        canCancel: isOwner && EDITABLE_STATUSES.includes(expense.status),
        payment: payment ? toPaymentView(payment) : null,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'findOne');
    }
  }

  /** GET /expenses: yêu cầu chi của chính người dùng (màn 08), mới cập nhật lên đầu */
  async listMine(query: ListExpensesQueryDto, actor: AuthUser): Promise<PaginatedResult<ExpenseListItem>> {
    try {
      const { page, limit, search, status } = query;
      const qb = this.expensesRepository
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.category', 'c')
        .where('e.requesterId = :userId', { userId: actor.userId });
      if (status) qb.andWhere('e.status = :status', { status });
      if (search) {
        // Thoát ký tự đặc biệt của LIKE để tìm đúng chuỗi người dùng gõ
        const keyword = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        qb.andWhere('(e.code ILIKE :keyword OR e.purpose ILIKE :keyword OR e.beneficiaryName ILIKE :keyword)', { keyword });
      }
      const [rows, total] = await qb
        .orderBy('e.updatedAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const items: ExpenseListItem[] = rows.map((e) => ({
        id: e.id,
        code: e.code,
        purpose: e.purpose,
        amount: e.amount,
        status: e.status,
        statusLabel: EXPENSE_STATUS_LABEL[e.status],
        dueDate: e.dueDate,
        version: e.version,
        categoryName: e.category?.name ?? null,
        submittedAt: e.submittedAt,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
      return paginate(items, total, page, limit);
    } catch (error) {
      handleServiceError(error, this.logger, 'listMine');
    }
  }

  /** GET /expenses/stats: thống kê hồ sơ của chính người dùng (không tính hồ sơ đã hủy) */
  async statsMine(actor: AuthUser): Promise<ExpenseStats> {
    try {
      const rows = await this.expensesRepository
        .createQueryBuilder('e')
        .select('e.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .addSelect('COALESCE(SUM(e.amount), 0)', 'amount')
        .addSelect('COALESCE(SUM(e.paidAmount), 0)', 'paid')
        .where('e.requesterId = :userId', { userId: actor.userId })
        .groupBy('e.status')
        .getRawMany<{ status: ExpenseStatus; count: number; amount: string; paid: string }>();
      const sum = (statuses: ExpenseStatus[], field: 'amount' | 'paid' = 'amount') => {
        const picked = rows.filter((r) => statuses.includes(r.status));
        return {
          count: picked.reduce((n, r) => n + Number(r.count), 0),
          amount: picked.reduce((n, r) => n + Number(r[field]), 0),
        };
      };
      return {
        total: sum(Object.values(ExpenseStatus).filter((st) => st !== ExpenseStatus.HUY)),
        inReview: sum(PENDING_EXPENSE_STATUSES),
        needChanges: sum([ExpenseStatus.CAN_BO_SUNG]),
        paid: sum([ExpenseStatus.CHI_MOT_PHAN, ExpenseStatus.DA_THANH_TOAN], 'paid'),
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'statsMine');
    }
  }

  /** POST /expenses/:id/cancel: người tạo hủy hồ sơ Nháp / Cần bổ sung (giữ lại để tra cứu, không tính ngân sách) */
  async cancel(id: string, actor: AuthUser): Promise<ExpenseView> {
    try {
      await this.expensesRepository.manager.transaction(async (manager) => {
        const expense = await manager.findOne(ExpenseRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!expense) throw new NotFoundException('Không tìm thấy yêu cầu chi');
        if (expense.requesterId !== actor.userId) throw new ForbiddenException('Chỉ người tạo được hủy yêu cầu chi này');
        if (!EDITABLE_STATUSES.includes(expense.status)) {
          throw new ConflictException(`Không thể hủy hồ sơ đang ở trạng thái ${EXPENSE_STATUS_LABEL[expense.status]}`);
        }
        expense.status = ExpenseStatus.HUY;
        await manager.save(expense);
      });
      return await this.findOneView(id);
    } catch (error) {
      handleServiceError(error, this.logger, 'cancel');
    }
  }

  // ---------------------------------------------------------------------------

  /** Sau khi gửi / gửi lại: lưu bản chụp phiên bản rồi định tuyến bước duyệt (có thể bỏ qua bước phòng) */
  private async afterSubmit(expense: ExpenseRequest, manager: EntityManager, actorId: string): Promise<void> {
    const [category, project, line] = await Promise.all([
      expense.categoryId ? manager.findOneBy(Categories, { id: expense.categoryId }) : null,
      expense.projectId ? manager.findOneBy(Project, { id: expense.projectId }) : null,
      expense.budgetLineId ? this.budgetsService.findLineView(expense.budgetLineId) : null,
    ]);
    const snapshot: ExpenseSnapshot = {
      purpose: expense.purpose,
      amount: expense.amount,
      categoryName: category?.name ?? null,
      projectName: project ? `${project.name} · ${project.code}` : null,
      budgetLineLabel: line ? `${line.label} · ${line.periodName}` : null,
      dueDate: expense.dueDate,
      beneficiaryName: expense.beneficiaryName,
      beneficiaryBankName: expense.beneficiaryBankName,
      beneficiaryAccountNumber: expense.beneficiaryAccountNumber,
      paymentMethod: PAYMENT_METHOD_LABEL[expense.paymentMethod] ?? expense.paymentMethod,
      note: expense.note,
    };
    await manager.save(
      manager.create(ExpenseRequestVersion, { expenseId: expense.id, version: expense.version, snapshot, submittedBy: actorId }),
    );
    await this.workflowService.routeAfterSubmit(expense, manager);
  }

  private async listVersions(expenseId: string): Promise<ExpenseVersionView[]> {
    const manager = this.expensesRepository.manager;
    const versions = await manager.find(ExpenseRequestVersion, { where: { expenseId }, order: { version: 'ASC' } });
    const userIds = [...new Set(versions.map((v) => v.submittedBy).filter((v): v is string => Boolean(v)))];
    const users = userIds.length
      ? await manager.find(Users, { where: { id: In(userIds) }, select: { id: true, username: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.username]));
    return versions.map((v) => ({
      version: v.version,
      submittedAt: v.submittedAt,
      submittedByName: v.submittedBy ? (names.get(v.submittedBy) ?? null) : null,
      snapshot: v.snapshot,
    }));
  }

  private applyChanges(expense: ExpenseRequest, dto: SaveExpenseDto): void {
    for (const field of EDITABLE_FIELDS) {
      const value = dto[field];
      if (value !== undefined) (expense as unknown as Record<string, unknown>)[field] = value;
    }
    // Tên chủ tài khoản: in hoa theo tên người thụ hưởng (bản chụp lúc lưu)
    expense.beneficiaryAccountName = expense.beneficiaryName ? expense.beneficiaryName.toLocaleUpperCase('vi-VN') : null;
  }

  /** Các mã tham chiếu (nếu đã chọn) phải tồn tại và hợp lệ, kể cả khi chỉ lưu nháp */
  private async validateReferences(expense: ExpenseRequest, manager: EntityManager): Promise<void> {
    if (expense.categoryId) {
      const category = await manager.findOneBy(Categories, { id: expense.categoryId });
      if (!category || category.type !== CategoryType.CHI) {
        throw new BadRequestException('Loại chi không tồn tại');
      }
    }
    if (expense.projectId) {
      const exists = await manager.existsBy(Project, { id: expense.projectId });
      if (!exists) throw new BadRequestException('Dự án không tồn tại');
    }
    if (expense.budgetLineId) {
      const line = await this.budgetsService.findLineView(expense.budgetLineId);
      if (!line) throw new BadRequestException('Khoản mục ngân sách không tồn tại');
      if (line.departmentId !== expense.departmentId) {
        throw new BadRequestException('Khoản mục ngân sách không thuộc phòng ban của bạn');
      }
    }
  }

  /**
   * Kiểm tra đủ điều kiện gửi duyệt rồi chuyển trạng thái sang "Chờ trưởng phòng".
   * Lỗi thiếu thông tin trả về dạng { message, errors: [...] } giống lỗi ValidationPipe.
   */
  private async submitInPlace(expense: ExpenseRequest): Promise<void> {
    const errors: string[] = [];
    if (!expense.purpose) errors.push('Nhập nội dung / mục đích chi');
    if (!expense.amount) errors.push('Nhập số tiền đề nghị');
    if (!expense.categoryId) errors.push('Chọn loại chi');
    if (!expense.budgetLineId) errors.push('Chọn khoản mục ngân sách');
    if (!expense.dueDate) errors.push('Chọn ngày cần chi');
    else if (expense.dueDate < todayVN()) errors.push('Ngày cần chi không được ở quá khứ');
    if (!expense.beneficiaryName) errors.push('Nhập người thụ hưởng');
    if (expense.paymentMethod === PaymentMethod.CHUYEN_KHOAN) {
      if (!expense.beneficiaryBankName) errors.push('Nhập ngân hàng thụ hưởng');
      if (!expense.beneficiaryAccountNumber) errors.push('Nhập số tài khoản thụ hưởng');
    }
    if (errors.length > 0) {
      throw new BadRequestException({ message: errors, error: 'Bad Request' });
    }

    const manager = this.expensesRepository.manager;
    const category = await manager.findOneBy(Categories, { id: expense.categoryId! });
    if (category?.status !== CategoryStatus.DANG_SU_DUNG) {
      throw new BadRequestException(`Loại chi "${category?.name ?? ''}" đã ngừng sử dụng`);
    }
    if (expense.projectId) {
      const project = await manager.findOneBy(Project, { id: expense.projectId });
      if (project?.status !== ProjectStatus.DANG_CHAY) {
        throw new BadRequestException(`Dự án ${project?.code ?? ''} đã đóng`);
      }
    }

    // Đọc lại số khả dụng ngay lúc gửi (không tính chính hồ sơ này)
    const line = (await this.budgetsService.findLineView(expense.budgetLineId!))!;
    if (line.periodStatus !== BudgetPeriodStatus.MO) {
      throw new BadRequestException(`Kỳ ngân sách ${line.periodName} không còn mở`);
    }
    if (line.categoryId !== expense.categoryId) {
      throw new BadRequestException(`Khoản mục "${line.label}" không thuộc loại chi đã chọn`);
    }
    const usage = (await this.budgetsService.getUsage([line.id], expense.id)).get(line.id)!;
    const available = line.plannedAmount - usage.spent - usage.committed;
    if (expense.amount! > available) {
      throw new BadRequestException(
        `Số tiền vượt ngân sách khả dụng của "${line.label}": còn ${available.toLocaleString('vi-VN')} VND`,
      );
    }

    expense.status = ExpenseStatus.CHO_TRUONG_PHONG;
    expense.submittedAt = new Date();
  }

  private async findActorDepartment(userId: string): Promise<Department | null> {
    const manager = this.expensesRepository.manager;
    const user = await manager.findOne(Users, { where: { id: userId }, select: { id: true, departmentId: true } });
    if (!user?.departmentId) return null;
    return await manager.findOneBy(Department, { id: user.departmentId });
  }

  private async findOneView(id: string): Promise<ExpenseView> {
    const expense = await this.expensesRepository.findOne({
      where: { id },
      relations: { category: true, project: true, department: true, requester: true },
    });
    if (!expense) throw new NotFoundException('Không tìm thấy yêu cầu chi');
    const budgetLine = expense.budgetLineId ? await this.budgetsService.findLineView(expense.budgetLineId) : null;
    const { category, project, department, budgetLine: _line, requester, ...rest } = expense;
    return {
      ...rest,
      statusLabel: EXPENSE_STATUS_LABEL[expense.status] ?? expense.status,
      paymentMethodLabel: PAYMENT_METHOD_LABEL[expense.paymentMethod] ?? expense.paymentMethod,
      categoryName: category?.name ?? null,
      projectName: project ? `${project.name} · ${project.code}` : null,
      departmentName: department?.name ?? null,
      requesterName: requester?.username ?? null,
      budgetLine,
    };
  }
}

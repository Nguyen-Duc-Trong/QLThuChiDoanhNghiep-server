import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
import { PaginatedResult, paginate } from '../common/response.js';
import { ListApprovalsQueryDto } from './dto/list-approvals.dto.js';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { BudgetsService } from '../budgets/budgets.service.js';
import { BudgetLine } from '../budgets/entity/budget-line.entity.js';
import { handleServiceError } from '../common/handle-error.js';
import {
  APPROVAL_DECISION_LABEL,
  APPROVAL_STEP_LABEL,
  ApprovalDecision,
  ApprovalStep,
  BudgetPeriodStatus,
  EXPENSE_STATUS_LABEL,
  ExpenseStatus,
  PENDING_EXPENSE_STATUSES,
  type Permission,
} from '../common/types.js';
import { DelegationsService } from '../department/delegations.service.js';
import { isActiveUser } from '../department/department.service.js';
import { Department } from '../department/entity/department.entity.js';
import { SettingsService } from '../department/settings.service.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { Users } from '../users/entity/users.entity.js';
import { DecideDto } from './dto/decide.dto.js';
import { ApprovalRecord } from './entity/approval-record.entity.js';

/** Trạng thái chờ duyệt -> bước duyệt tương ứng */
export const STEP_OF_STATUS: Partial<Record<ExpenseStatus, ApprovalStep>> = {
  [ExpenseStatus.CHO_TRUONG_PHONG]: ApprovalStep.DEPT,
  [ExpenseStatus.CHO_KE_TOAN]: ApprovalStep.ACCOUNTING,
  [ExpenseStatus.CHO_LANH_DAO]: ApprovalStep.FINAL,
};

const STEP_PERMISSION: Record<ApprovalStep, Permission> = {
  [ApprovalStep.DEPT]: 'approval.dept',
  [ApprovalStep.ACCOUNTING]: 'approval.accounting',
  [ApprovalStep.FINAL]: 'approval.final',
};

// Duyệt xong một bước thì chuyển sang trạng thái này
const NEXT_STATUS: Record<ApprovalStep, ExpenseStatus> = {
  [ApprovalStep.DEPT]: ExpenseStatus.CHO_KE_TOAN,
  [ApprovalStep.ACCOUNTING]: ExpenseStatus.CHO_LANH_DAO,
  [ApprovalStep.FINAL]: ExpenseStatus.DA_DUYET,
};

// Ai có các quyền này được xem mọi hồ sơ chi (phạm vi toàn công ty)
const COMPANY_VIEW_PERMISSIONS: Permission[] = ['approval.accounting', 'approval.final', 'payment.execute'];

export type BudgetHealth = 'TRONG_HAN_MUC' | 'GAN_VUOT' | 'VUOT_HAN_MUC';

export interface ApprovalRecordView {
  id: string;
  version: number;
  step: ApprovalStep;
  stepLabel: string;
  decision: ApprovalDecision;
  decisionLabel: string;
  actorId: string | null;
  actorName: string | null;
  onBehalfOfName: string | null;
  note: string | null;
  fields: string[];
  checklist: Record<string, boolean> | null;
  createdAt: Date;
}

/** Bước đang chờ của một hồ sơ và người dùng hiện tại có được quyết định không */
export interface WorkflowInfo {
  step: ApprovalStep | null;
  stepLabel: string | null;
  approverNames: string[];
  // Hồ sơ đang kẹt vì không ai đủ điều kiện duyệt bước hiện tại
  blockedReason: string | null;
  canDecide: boolean;
  // Người dùng hiện tại duyệt thay cho ai (theo ủy quyền)
  actingForName: string | null;
}

export interface ApprovalQueueItem {
  id: string;
  code: string;
  purpose: string | null;
  amount: number | null;
  dueDate: string | null;
  status: ExpenseStatus;
  statusLabel: string;
  step: ApprovalStep;
  stepLabel: string;
  version: number;
  submittedAt: Date | null;
  requesterName: string | null;
  departmentId: string;
  departmentName: string | null;
  budgetLineLabel: string | null;
  availableAmount: number | null;
  budgetHealth: BudgetHealth | null;
  actingForName: string | null;
}

/** Một dòng ở danh sách phê duyệt (GET /approvals): mọi trạng thái, đánh dấu hồ sơ đang chờ tôi */
export interface ApprovalListItem {
  id: string;
  code: string;
  purpose: string | null;
  amount: number | null;
  dueDate: string | null;
  status: ExpenseStatus;
  statusLabel: string;
  version: number;
  submittedAt: Date | null;
  updatedAt: Date;
  requesterName: string | null;
  departmentName: string | null;
  awaitingMe: boolean;
  step: ApprovalStep | null;
  stepLabel: string | null;
  actingForName: string | null;
  budgetHealth: BudgetHealth | null;
  /** Lần gần nhất tôi bấm Duyệt hồ sơ này (null nếu chưa từng) — tab "Đã phê duyệt" */
  myApprovedAt: Date | null;
  myApprovedStepLabel: string | null;
}

type ContextUser =Pick<Users, 'id' | 'username' | 'role' | 'status' | 'departmentId'>;

/** Dữ liệu dùng chung khi xét nhiều hồ sơ trong một request (người dùng, quyền, phòng ban) */
interface WorkflowContext {
  users: Map<string, ContextUser>;
  permissions: Map<string, Set<Permission>>;
  departments: Map<string, Department>;
}

/** Người được quyết định ở bước hiện tại: userId -> duyệt thay cho ai (null = duyệt với tư cách chính) */
interface StepApprovers {
  step: ApprovalStep | null;
  approvers: Map<string, string | null>;
}

/**
 * Luồng duyệt chi 3 cấp: Trưởng phòng → Kế toán → Lãnh đạo.
 * - Bước phòng: trưởng phòng; nếu chính trưởng phòng tạo hồ sơ thì người phụ trách duyệt; cộng người được ủy quyền.
 *   Không còn ai hợp lệ vì trưởng phòng tự tạo → hệ thống bỏ qua bước phòng, chuyển thẳng kế toán (ghi BO_QUA).
 * - Bước kế toán / lãnh đạo: mọi người có quyền approval.accounting / approval.final, cộng người được họ ủy quyền.
 * - Không ai được duyệt hồ sơ do chính mình tạo.
 * - Duyệt cuối kiểm tra lại ngân sách khả dụng; từ lúc này số tiền tính là "cam kết" của dòng ngân sách.
 */
@Injectable()
export class ApprovalWorkflowService {
  private readonly logger = new Logger(ApprovalWorkflowService.name);

  constructor(
    @InjectRepository(ApprovalRecord)
    private readonly recordsRepository: Repository<ApprovalRecord>,
    @InjectRepository(ExpenseRequest)
    private readonly expensesRepository: Repository<ExpenseRequest>,
    private readonly permissionsService: PermissionsService,
    private readonly delegationsService: DelegationsService,
    private readonly budgetsService: BudgetsService,
    private readonly settingsService: SettingsService,
  ) {}

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------

  /** GET /approvals/queue: hồ sơ đang chờ đúng bước mà người dùng được quyết định */
  async getQueue(actor: AuthUser): Promise<ApprovalQueueItem[]> {
    try {
      const expenses = await this.expensesRepository.find({
        where: { status: In(PENDING_EXPENSE_STATUSES) },
        order: { dueDate: 'ASC', submittedAt: 'ASC' },
      });
      if (expenses.length === 0) return [];

      const ctx = await this.loadContext();
      const mine: { expense: ExpenseRequest; step: ApprovalStep; actingFor: string | null }[] = [];
      for (const expense of expenses) {
        const { step, approvers } = await this.resolveApprovers(expense, ctx);
        if (step && approvers.has(actor.userId)) {
          mine.push({ expense, step, actingFor: approvers.get(actor.userId) ?? null });
        }
      }
      if (mine.length === 0) return [];

      const threshold = (await this.settingsService.getSettings()).budgetWarningThreshold;
      const lineIds = [...new Set(mine.map((m) => m.expense.budgetLineId).filter((v): v is string => Boolean(v)))];
      const lines = new Map(
        (await Promise.all(lineIds.map((id) => this.budgetsService.findLineView(id))))
          .filter((l) => l !== null)
          .map((l) => [l.id, l]),
      );

      return mine.map(({ expense, step, actingFor }) => {
        const line = expense.budgetLineId ? lines.get(expense.budgetLineId) : undefined;
        return {
          id: expense.id,
          code: expense.code,
          purpose: expense.purpose,
          amount: expense.amount,
          dueDate: expense.dueDate,
          status: expense.status,
          statusLabel: EXPENSE_STATUS_LABEL[expense.status],
          step,
          stepLabel: APPROVAL_STEP_LABEL[step],
          version: expense.version,
          submittedAt: expense.submittedAt,
          requesterName: ctx.users.get(expense.requesterId)?.username ?? null,
          departmentId: expense.departmentId,
          departmentName: ctx.departments.get(expense.departmentId)?.name ?? null,
          budgetLineLabel: line?.label ?? null,
          availableAmount: line?.availableAmount ?? null,
          budgetHealth: line ? budgetHealth(line.plannedAmount, line.availableAmount, expense.amount ?? 0, threshold) : null,
          actingForName: actingFor ? (ctx.users.get(actingFor)?.username ?? null) : null,
        };
      });
    } catch (error) {
      handleServiceError(error, this.logger, 'getQueue');
    }
  }

  /**
   * GET /approvals: danh sách hồ sơ (trừ nháp) trong phạm vi người dùng được xem, kèm trạng thái và cờ "đang chờ tôi".
   * Phạm vi: có quyền xem toàn công ty (kế toán / lãnh đạo / thực chi) → mọi hồ sơ; còn lại → hồ sơ của phòng tôi làm
   * trưởng phòng / người phụ trách duyệt, hồ sơ tôi từng quyết định và hồ sơ đang chờ tôi (kể cả theo ủy quyền).
   * Hồ sơ chờ tôi luôn lên đầu, sau đó mới gửi / cập nhật gần nhất.
   */
  async listForActor(
    query: ListApprovalsQueryDto,
    actor: AuthUser,
  ): Promise<PaginatedResult<ApprovalListItem>> {
    try {
      const { page, limit, search, status, view } = query;
      const queue = await this.getQueue(actor);
      const awaiting = new Map(queue.map((q) => [q.id, q]));
      const awaitingIds = [...awaiting.keys()];

      const owned = await this.permissionsService.getEffective(actor.userId, actor.role);
      const companyWide = COMPANY_VIEW_PERMISSIONS.some((p) => owned.includes(p));

      const base = () => {
        const qb = this.expensesRepository
          .createQueryBuilder('e')
          .leftJoin('e.department', 'd')
          .leftJoin('e.requester', 'u')
          .where('e.status <> :draft', { draft: ExpenseStatus.NHAP });
        if (!companyWide) {
          qb.andWhere(
            new Brackets((w) => {
              w.where('d.headId = :me OR d.approverId = :me', { me: actor.userId }).orWhere(
                `EXISTS (SELECT 1 FROM "ApprovalRecords" r WHERE r."expenseId" = e.id AND r."actorId" = :me)`,
              );
              if (awaitingIds.length) w.orWhere('e.id IN (:...awaitingIds)', { awaitingIds });
            }),
          );
        }
        return qb;
      };

      const qb = base().select(['e', 'd.id', 'd.name', 'u.id', 'u.username']);
      if (view === 'awaiting') {
        if (!awaitingIds.length) return paginate([], 0, page, limit);
        qb.andWhere('e.id IN (:...awaitingIds)', { awaitingIds });
      }
      if (view === 'approved') {
        qb.andWhere(
          `EXISTS (SELECT 1 FROM "ApprovalRecords" r WHERE r."expenseId" = e.id AND r."actorId" = :me AND r.decision = :approved)`,
          { me: actor.userId, approved: ApprovalDecision.DUYET },
        );
      }
      if (status) qb.andWhere('e.status = :status', { status });
      if (search) {
        const keyword = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        qb.andWhere(
          '(e.code ILIKE :keyword OR e.purpose ILIKE :keyword OR e.beneficiaryName ILIKE :keyword OR u.username ILIKE :keyword)',
          { keyword },
        );
      }
      if (view === 'approved') {
        // Hồ sơ tôi vừa duyệt lên đầu
        qb.orderBy(
          `(SELECT MAX(r."createdAt") FROM "ApprovalRecords" r WHERE r."expenseId" = e.id AND r."actorId" = :me AND r.decision = :approved)`,
          'DESC',
        ).addOrderBy('e.updatedAt', 'DESC');
      } else if (awaitingIds.length) {
        qb.orderBy('CASE WHEN e.id IN (:...awaitingIds) THEN 0 ELSE 1 END', 'ASC')
          .setParameter('awaitingIds', awaitingIds)
          .addOrderBy('e.updatedAt', 'DESC');
      } else {
        qb.orderBy('e.updatedAt', 'DESC');
      }

      // Chỉ nối quan hệ nhiều-một (không nhân dòng) nên phân trang thẳng bằng OFFSET / LIMIT
      const [rows, total] = await qb
        .offset((page - 1) * limit)
        .limit(limit)
        .getManyAndCount();

      // Lần duyệt gần nhất của tôi trên từng hồ sơ trong trang (một truy vấn cho cả trang)
      const myApprovals = new Map<string, ApprovalRecord>();
      if (rows.length) {
        const records = await this.recordsRepository.find({
          where: { expenseId: In(rows.map((e) => e.id)), actorId: actor.userId, decision: ApprovalDecision.DUYET },
          order: { createdAt: 'DESC' },
        });
        for (const r of records) if (!myApprovals.has(r.expenseId)) myApprovals.set(r.expenseId, r);
      }

      const items: ApprovalListItem[] = rows.map((e) => {
        const mine = awaiting.get(e.id);
        const approved = myApprovals.get(e.id);
        return {
          id: e.id,
          code: e.code,
          purpose: e.purpose,
          amount: e.amount,
          dueDate: e.dueDate,
          status: e.status,
          statusLabel: EXPENSE_STATUS_LABEL[e.status],
          version: e.version,
          submittedAt: e.submittedAt,
          updatedAt: e.updatedAt,
          requesterName: e.requester?.username ?? null,
          departmentName: e.department?.name ?? null,
          awaitingMe: Boolean(mine),
          step: mine?.step ?? null,
          stepLabel: mine?.stepLabel ?? null,
          actingForName: mine?.actingForName ?? null,
          budgetHealth: mine?.budgetHealth ?? null,
          myApprovedAt: approved?.createdAt ?? null,
          myApprovedStepLabel: approved ? APPROVAL_STEP_LABEL[approved.step] : null,
        };
      });
      return paginate(items, total, page, limit);
    } catch (error) {
      handleServiceError(error, this.logger, 'listForActor');
    }
  }

  /**
   * Số hồ sơ đang chờ từng người quyết định (số trên menu Phê duyệt).
   * Một lần đọc hồ sơ + ngữ cảnh cho cả danh sách người, nhẹ hơn gọi getQueue cho từng người.
   */
  async countQueues(userIds: string[]): Promise<Map<string, number>> {
    const counts = new Map(userIds.map((id) => [id, 0]));
    if (userIds.length === 0) return counts;
    const expenses = await this.expensesRepository.find({ where: { status: In(PENDING_EXPENSE_STATUSES) } });
    if (expenses.length === 0) return counts;
    const ctx = await this.loadContext();
    for (const expense of expenses) {
      const { step, approvers } = await this.resolveApprovers(expense, ctx);
      if (!step) continue;
      for (const userId of approvers.keys()) {
        if (counts.has(userId)) counts.set(userId, counts.get(userId)! + 1);
      }
    }
    return counts;
  }

  /** POST /approvals/:id/decision */
  async decide(expenseId: string, dto: DecideDto, actor: AuthUser): Promise<{ id: string; code: string; status: ExpenseStatus; statusLabel: string }> {
    try {
      const note = dto.note?.trim() || null;
      if ((dto.decision === ApprovalDecision.BO_SUNG || dto.decision === ApprovalDecision.TU_CHOI) && !note) {
        throw new BadRequestException(
          dto.decision === ApprovalDecision.BO_SUNG ? 'Nhập lý do cần bổ sung' : 'Nhập lý do từ chối',
        );
      }

      const ctx = await this.loadContext();
      const result = await this.expensesRepository.manager.transaction(async (manager) => {
        // Khóa dòng: hai người cùng bấm duyệt một hồ sơ thì người sau nhận 409
        const expense = await manager.findOne(ExpenseRequest, { where: { id: expenseId }, lock: { mode: 'pessimistic_write' } });
        if (!expense) throw new NotFoundException('Không tìm thấy yêu cầu chi');

        const { step, approvers } = await this.resolveApprovers(expense, ctx);
        if (!step) throw new ConflictException(`Hồ sơ ${expense.code} không còn chờ duyệt (${EXPENSE_STATUS_LABEL[expense.status]})`);
        if (step !== dto.step || expense.version !== dto.version) {
          throw new ConflictException(`Hồ sơ ${expense.code} đã thay đổi, vui lòng tải lại trước khi quyết định`);
        }
        if (expense.requesterId === actor.userId) {
          throw new ForbiddenException('Không được duyệt hồ sơ do chính mình tạo');
        }
        if (!approvers.has(actor.userId)) {
          throw new ForbiddenException(`Bạn không phải người duyệt bước "${APPROVAL_STEP_LABEL[step]}" của hồ sơ này`);
        }

        if (dto.decision === ApprovalDecision.DUYET) {
          if (step === ApprovalStep.FINAL) {
            await this.assertBudgetForFinal(expense, manager);
            expense.finalApprovedAt = new Date();
          }
          expense.status = NEXT_STATUS[step];
        } else if (dto.decision === ApprovalDecision.BO_SUNG) {
          expense.status = ExpenseStatus.CAN_BO_SUNG;
        } else {
          expense.status = ExpenseStatus.TU_CHOI;
        }

        await manager.save(
          manager.create(ApprovalRecord, {
            expenseId: expense.id,
            version: expense.version,
            step,
            decision: dto.decision,
            actorId: actor.userId,
            onBehalfOfId: approvers.get(actor.userId) ?? null,
            note,
            fields: dto.decision === ApprovalDecision.BO_SUNG ? (dto.fields ?? []) : [],
            checklist: step === ApprovalStep.ACCOUNTING ? (dto.checklist ?? null) : null,
          }),
        );
        await manager.save(expense);
        return expense;
      });

      return {
        id: result.id,
        code: result.code,
        status: result.status,
        statusLabel: EXPENSE_STATUS_LABEL[result.status],
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'decide');
    }
  }

  // ---------------------------------------------------------------------------
  // Dùng từ ExpensesService
  // ---------------------------------------------------------------------------

  /**
   * Gọi ngay sau khi hồ sơ được gửi / gửi lại (status = CHO_TRUONG_PHONG, đã lưu).
   * Không có người duyệt cấp phòng hợp lệ vì người tạo là trưởng phòng → bỏ qua bước phòng, chuyển kế toán.
   */
  async routeAfterSubmit(expense: ExpenseRequest, manager: EntityManager): Promise<void> {
    if (expense.status !== ExpenseStatus.CHO_TRUONG_PHONG) return;
    const ctx = await this.loadContext();
    const { approvers } = await this.resolveApprovers(expense, ctx);
    if (approvers.size > 0) return;

    const department = ctx.departments.get(expense.departmentId);
    // Phòng chưa cấu hình người duyệt (không phải do tự tạo) thì giữ nguyên để quản trị bổ sung, không tự bỏ qua
    if (!department || department.headId !== expense.requesterId) return;

    await manager.save(
      manager.create(ApprovalRecord, {
        expenseId: expense.id,
        version: expense.version,
        step: ApprovalStep.DEPT,
        decision: ApprovalDecision.BO_QUA,
        actorId: null,
        note: `Người tạo là trưởng phòng ${department.name} và không có người duyệt thay hợp lệ (người phụ trách duyệt / ủy quyền): hệ thống chuyển thẳng kế toán thẩm định.`,
      }),
    );
    expense.status = ExpenseStatus.CHO_KE_TOAN;
    await manager.save(expense);
  }

  /** Lịch sử quyết định của một hồ sơ, cũ trước mới sau */
  async listRecords(expenseId: string): Promise<ApprovalRecordView[]> {
    const records = await this.recordsRepository.find({
      where: { expenseId },
      relations: { actor: true, onBehalfOf: true },
      order: { createdAt: 'ASC' },
    });
    return records.map((r) => ({
      id: r.id,
      version: r.version,
      step: r.step,
      stepLabel: APPROVAL_STEP_LABEL[r.step],
      decision: r.decision,
      decisionLabel: APPROVAL_DECISION_LABEL[r.decision],
      actorId: r.actorId,
      actorName: r.actor?.username ?? (r.decision === ApprovalDecision.BO_QUA ? 'Hệ thống' : null),
      onBehalfOfName: r.onBehalfOf?.username ?? null,
      note: r.note,
      fields: r.fields ?? [],
      checklist: r.checklist,
      createdAt: r.createdAt,
    }));
  }

  /** Bước đang chờ + ai đang được duyệt + người dùng hiện tại có quyết định được không */
  async getWorkflowInfo(expense: ExpenseRequest, actorId: string): Promise<WorkflowInfo> {
    const ctx = await this.loadContext();
    const { step, approvers } = await this.resolveApprovers(expense, ctx);
    if (!step) {
      return { step: null, stepLabel: null, approverNames: [], blockedReason: null, canDecide: false, actingForName: null };
    }
    const actingFor = approvers.get(actorId) ?? null;
    return {
      step,
      stepLabel: APPROVAL_STEP_LABEL[step],
      approverNames: [...approvers.keys()].map((id) => ctx.users.get(id)?.username ?? id),
      blockedReason:
        approvers.size === 0
          ? step === ApprovalStep.DEPT
            ? 'Phòng ban chưa có trưởng phòng / người phụ trách duyệt có quyền duyệt. Liên hệ quản trị viên.'
            : `Chưa có người hợp lệ cho bước "${APPROVAL_STEP_LABEL[step]}" (người tạo không được tự duyệt). Cần ủy quyền cho người khác.`
          : null,
      canDecide: approvers.has(actorId) && expense.requesterId !== actorId,
      actingForName: actingFor ? (ctx.users.get(actingFor)?.username ?? null) : null,
    };
  }

  /**
   * Ai được xem hồ sơ: người tạo; trưởng phòng / người phụ trách duyệt của phòng; người đang được duyệt;
   * người đã từng quyết định; người có quyền kế toán / lãnh đạo / thực chi (toàn công ty).
   */
  async canView(expense: ExpenseRequest, actor: AuthUser): Promise<boolean> {
    if (expense.requesterId === actor.userId) return true;
    const owned = await this.permissionsService.getEffective(actor.userId, actor.role);
    if (COMPANY_VIEW_PERMISSIONS.some((p) => owned.includes(p))) return true;

    const department = await this.expensesRepository.manager.findOneBy(Department, { id: expense.departmentId });
    if (department && (department.headId === actor.userId || department.approverId === actor.userId)) return true;
    if (await this.recordsRepository.existsBy({ expenseId: expense.id, actorId: actor.userId })) return true;

    if (STEP_OF_STATUS[expense.status]) {
      const { approvers } = await this.resolveApprovers(expense, await this.loadContext());
      if (approvers.has(actor.userId)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Nội bộ
  // ---------------------------------------------------------------------------

  private async loadContext(): Promise<WorkflowContext> {
    const manager = this.expensesRepository.manager;
    const [users, departments] = await Promise.all([
      manager.find(Users, { select: { id: true, username: true, role: true, status: true, departmentId: true } }),
      manager.find(Department),
    ]);
    const active = users.filter(isActiveUser);
    const permissionLists = await Promise.all(active.map((u) => this.permissionsService.getEffective(u.id, u.role)));
    return {
      users: new Map(active.map((u) => [u.id, u])),
      permissions: new Map(active.map((u, i) => [u.id, new Set(permissionLists[i])])),
      departments: new Map(departments.map((d) => [d.id, d])),
    };
  }

  private async resolveApprovers(expense: ExpenseRequest, ctx: WorkflowContext): Promise<StepApprovers> {
    const step = STEP_OF_STATUS[expense.status] ?? null;
    const approvers = new Map<string, string | null>();
    if (!step) return { step, approvers };

    const requester = expense.requesterId;
    const amount = expense.amount ?? 0;
    const permission = STEP_PERMISSION[step];
    const hasPermission = (userId: string) => ctx.permissions.get(userId)?.has(permission) ?? false;
    const addDelegateOf = async (principalId: string) => {
      const delegate = await this.delegationsService.findActiveDelegate(principalId, expense.departmentId, amount);
      if (delegate && delegate !== requester && ctx.users.has(delegate) && !approvers.has(delegate)) {
        approvers.set(delegate, principalId);
      }
    };

    if (step === ApprovalStep.DEPT) {
      const department = ctx.departments.get(expense.departmentId);
      if (!department) return { step, approvers };
      // Trưởng phòng; chính trưởng phòng tạo hồ sơ thì người phụ trách duyệt (quy tắc không tự duyệt)
      const primary =
        department.headId && department.headId !== requester
          ? department.headId
          : department.approverId && department.approverId !== requester
            ? department.approverId
            : null;
      if (primary && ctx.users.has(primary) && hasPermission(primary)) approvers.set(primary, null);
      const delegateSource = primary ?? department.headId;
      if (delegateSource) await addDelegateOf(delegateSource);
      return { step, approvers };
    }

    // Kế toán / lãnh đạo: theo quyền, áp dụng toàn công ty
    const principals = [...ctx.users.keys()].filter(hasPermission);
    for (const id of principals) {
      if (id !== requester) approvers.set(id, null);
    }
    for (const id of principals) await addDelegateOf(id);
    return { step, approvers };
  }

  /** Duyệt cuối: kỳ còn mở và số tiền không vượt khả dụng (không tính chính hồ sơ này) */
  private async assertBudgetForFinal(expense: ExpenseRequest, manager: EntityManager): Promise<void> {
    if (!expense.budgetLineId || !expense.amount) {
      throw new BadRequestException('Hồ sơ chưa có khoản mục ngân sách hoặc số tiền');
    }
    // Khóa dòng ngân sách để hai lần duyệt cuối cùng lúc không cùng vượt hạn mức
    await manager.findOne(BudgetLine, { where: { id: expense.budgetLineId }, lock: { mode: 'pessimistic_write' } });
    const line = await this.budgetsService.findLineView(expense.budgetLineId);
    if (!line) throw new BadRequestException('Khoản mục ngân sách không tồn tại');
    if (line.periodStatus !== BudgetPeriodStatus.MO) {
      throw new BadRequestException(`Kỳ ngân sách ${line.periodName} không còn mở`);
    }
    const usage = (await this.budgetsService.getUsage([line.id], expense.id)).get(line.id)!;
    const available = line.plannedAmount - usage.spent - usage.committed;
    if (expense.amount > available) {
      throw new BadRequestException(
        `Không thể duyệt cuối: số tiền vượt ngân sách khả dụng của "${line.label}" (còn ${available.toLocaleString('vi-VN')} VND)`,
      );
    }
  }
}

/** Mức sử dụng ngân sách nếu hồ sơ được duyệt: vượt / gần vượt (≥ ngưỡng cấu hình) / trong hạn mức */
export function budgetHealth(planned: number, available: number, amount: number, thresholdPercent: number): BudgetHealth {
  const after = available - amount;
  if (after < 0) return 'VUOT_HAN_MUC';
  const usedPercent = planned > 0 ? ((planned - after) / planned) * 100 : 100;
  return usedPercent >= thresholdPercent ? 'GAN_VUOT' : 'TRONG_HAN_MUC';
}


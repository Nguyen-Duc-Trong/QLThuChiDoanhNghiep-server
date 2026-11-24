import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { nextDocumentCode, todayVN } from '../common/document-code.js';
import { handleServiceError } from '../common/handle-error.js';
import { PaginatedResult, paginate } from '../common/response.js';
import {
  EXPENSE_STATUS_LABEL,
  ExpenseStatus,
  PAYMENT_METHOD_LABEL,
  PaymentMethod,
} from '../common/types.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { ExecutePaymentDto } from './dto/execute-payment.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions.dto.js';
import { ListPaymentRequestsQueryDto, PAYMENT_REQUEST_STATUSES } from './dto/list-payment-requests.dto.js';
import { PaymentTransaction } from './entity/payment-transaction.entity.js';
import { MAX_PROOF_SIZE, UploadedProof, decodeFileName, proofExtension } from './payment-proof.js';

/** Một lệnh chi (màn 15, 16) */
export interface PaymentView {
  id: string;
  code: string;
  expenseId: string;
  expenseCode: string | null;
  expensePurpose: string | null;
  departmentName: string | null;
  beneficiaryName: string | null;
  beneficiaryBankName: string | null;
  beneficiaryAccountNumber: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  // Chỉ có ở lệnh chi cũ (trước khi đổi sang upload ủy nhiệm chi)
  sourceAccount: string | null;
  bankName: string | null;
  bankRef: string | null;
  // File ủy nhiệm chi (null ở lệnh chi cũ); tải về qua GET /payments/:expenseId/proof
  proofFileName: string | null;
  proofMimeType: string | null;
  proofSize: number | null;
  executedAt: string;
  executedByName: string | null;
  note: string | null;
  createdAt: Date;
}

/** Hồ sơ ở danh sách thanh toán: Đã duyệt (chờ chi) hoặc Đã thanh toán */
export interface PaymentRequestItem {
  id: string;
  code: string;
  purpose: string | null;
  amount: number;
  dueDate: string | null;
  // Chờ chi mà đã qua ngày cần chi
  overdue: boolean;
  status: ExpenseStatus;
  statusLabel: string;
  paymentCode: string | null;
  paidAt: string | null;
  requesterName: string | null;
  departmentName: string | null;
  beneficiaryName: string | null;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  finalApprovedAt: Date | null;
}

export interface PaymentStats {
  pending: { count: number; amount: number };
  thisMonth: { count: number; amount: number };
}

/** Quan hệ cần nạp để dựng PaymentView */
const VIEW_RELATIONS = { expense: { department: true }, executedBy: true } as const;

export function toPaymentView(tx: PaymentTransaction): PaymentView {
  const expense = tx.expense as ExpenseRequest | undefined;
  return {
    id: tx.id,
    code: tx.code,
    expenseId: tx.expenseId,
    expenseCode: expense?.code ?? null,
    expensePurpose: expense?.purpose ?? null,
    departmentName: expense?.department?.name ?? null,
    beneficiaryName: expense?.beneficiaryName ?? null,
    beneficiaryBankName: expense?.beneficiaryBankName ?? null,
    beneficiaryAccountNumber: expense?.beneficiaryAccountNumber ?? null,
    amount: tx.amount,
    paymentMethod: tx.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABEL[tx.paymentMethod] ?? tx.paymentMethod,
    sourceAccount: tx.sourceAccount,
    bankName: tx.bankName,
    bankRef: tx.bankRef,
    proofFileName: tx.proofFileName,
    proofMimeType: tx.proofMimeType,
    proofSize: tx.proofSize,
    executedAt: tx.executedAt,
    executedByName: tx.executedBy?.username ?? null,
    note: tx.note,
    createdAt: tx.createdAt,
  };
}

/**
 * Thực hiện chi (bước 5 của luồng chi).
 * - Chỉ hồ sơ Đã duyệt (đủ 3 cấp) mới được chi; kế toán tải lên file ủy nhiệm chi và bấm Hoàn thành chi
 *   → chi một lần, đủ số tiền đã duyệt, hồ sơ chuyển Hoàn thành.
 * - Hệ thống dừng ở đó; không đối soát sao kê ngân hàng.
 * - Ngân sách tự cập nhật: BudgetsService tính "đã chi" từ paidAmount và "cam kết" từ hồ sơ Đã duyệt chưa chi.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentsRepository: Repository<PaymentTransaction>,
    @InjectRepository(ExpenseRequest)
    private readonly expensesRepository: Repository<ExpenseRequest>,
  ) {}

  /**
   * GET /payments/requests: hồ sơ thuộc phạm vi thanh toán (Đã duyệt = chờ chi, Đã thanh toán), kèm trạng thái.
   * Hồ sơ chờ chi lên đầu (đến hạn sớm nhất trước), sau đó hồ sơ đã chi gần nhất.
   */
  async listRequests(query: ListPaymentRequestsQueryDto): Promise<PaginatedResult<PaymentRequestItem>> {
    try {
      const { page, limit, search, status } = query;
      const today = todayVN();
      const qb = this.expensesRepository
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.department', 'd')
        .leftJoinAndSelect('e.requester', 'u')
        .leftJoinAndMapOne('e.payment', PaymentTransaction, 'p', 'p.expenseId = e.id')
        .where('e.status IN (:...statuses)', { statuses: status ? [status] : PAYMENT_REQUEST_STATUSES });
      if (search) {
        const keyword = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        qb.andWhere(
          '(e.code ILIKE :keyword OR e.purpose ILIKE :keyword OR e.beneficiaryName ILIKE :keyword OR u.username ILIKE :keyword)',
          { keyword },
        );
      }
      // Chỉ nối quan hệ một-một / nhiều-một (không nhân dòng) nên phân trang thẳng bằng OFFSET / LIMIT
      const [rows, total] = await qb
        .orderBy(`CASE WHEN e.status = '${ExpenseStatus.DA_DUYET}' THEN 0 ELSE 1 END`, 'ASC')
        .addOrderBy(`CASE WHEN e.status = '${ExpenseStatus.DA_DUYET}' THEN e."dueDate" END`, 'ASC', 'NULLS LAST')
        .addOrderBy('e.updatedAt', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getManyAndCount();

      const items = rows.map((e): PaymentRequestItem => {
        const payment = (e as ExpenseRequest & { payment?: PaymentTransaction }).payment;
        const pending = e.status === ExpenseStatus.DA_DUYET;
        return {
          id: e.id,
          code: e.code,
          purpose: e.purpose,
          amount: e.amount ?? 0,
          dueDate: e.dueDate,
          overdue: pending && Boolean(e.dueDate && e.dueDate < today),
          status: e.status,
          statusLabel: pending ? 'Chờ chi' : EXPENSE_STATUS_LABEL[e.status],
          requesterName: e.requester?.username ?? null,
          departmentName: e.department?.name ?? null,
          beneficiaryName: e.beneficiaryName,
          paymentMethod: e.paymentMethod,
          paymentMethodLabel: PAYMENT_METHOD_LABEL[e.paymentMethod] ?? e.paymentMethod,
          finalApprovedAt: e.finalApprovedAt,
          paymentCode: payment?.code ?? null,
          paidAt: payment?.executedAt ?? null,
        };
      });
      return paginate(items, total, page, limit);
    } catch (error) {
      handleServiceError(error, this.logger, 'listRequests');
    }
  }

  /** GET /payments/stats: số hồ sơ chờ chi + số lệnh chi trong tháng hiện tại */
  async stats(): Promise<PaymentStats> {
    try {
      const pending = await this.expensesRepository
        .createQueryBuilder('e')
        .select('COUNT(*)::int', 'count')
        .addSelect('COALESCE(SUM(e.amount - e.paidAmount), 0)', 'amount')
        .where('e.status = :status', { status: ExpenseStatus.DA_DUYET })
        .getRawOne<{ count: number; amount: string }>();
      const [from, to] = monthRange(todayVN().slice(0, 7));
      const month = await this.paymentsRepository
        .createQueryBuilder('p')
        .select('COUNT(*)::int', 'count')
        .addSelect('COALESCE(SUM(p.amount), 0)', 'amount')
        .where('p.executedAt >= :from AND p.executedAt < :to', { from, to })
        .getRawOne<{ count: number; amount: string }>();
      return {
        pending: { count: Number(pending?.count ?? 0), amount: Number(pending?.amount ?? 0) },
        thisMonth: { count: Number(month?.count ?? 0), amount: Number(month?.amount ?? 0) },
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'stats');
    }
  }

  /** GET /payments/transactions: lịch sử lệnh chi (chỉ xem), mới nhất lên đầu */
  async listTransactions(query: ListTransactionsQueryDto): Promise<PaginatedResult<PaymentView>> {
    try {
      const { page, limit, search, month, source } = query;
      const qb = this.paymentsRepository
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.expense', 'e')
        .leftJoinAndSelect('e.department', 'd')
        .leftJoinAndSelect('p.executedBy', 'u');
      if (month) {
        const [from, to] = monthRange(month);
        qb.andWhere('p.executedAt >= :from AND p.executedAt < :to', { from, to });
      }
      if (source) qb.andWhere('p.sourceAccount = :source', { source });
      if (search) {
        const keyword = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        qb.andWhere(
          '(p.code ILIKE :keyword OR p.bankRef ILIKE :keyword OR e.code ILIKE :keyword OR e.beneficiaryName ILIKE :keyword)',
          { keyword },
        );
      }
      const [rows, total] = await qb
        .orderBy('p.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return paginate(rows.map(toPaymentView), total, page, limit);
    } catch (error) {
      handleServiceError(error, this.logger, 'listTransactions');
    }
  }

  /** Lệnh chi của một hồ sơ (null nếu chưa chi) – dùng cho màn chi tiết hồ sơ */
  async findByExpense(expenseId: string): Promise<PaymentView | null> {
    const tx = await this.paymentsRepository.findOne({ where: { expenseId }, relations: VIEW_RELATIONS });
    return tx ? toPaymentView(tx) : null;
  }

  /**
   * POST /payments/:expenseId: kế toán tải lên file ủy nhiệm chi và Hoàn thành chi.
   * Khóa dòng hồ sơ trong transaction để hai lần bấm liên tiếp không tạo hai lệnh chi.
   * File lưu cùng lệnh chi trong một transaction: lỗi thì cả hai cùng không được lưu.
   */
  async execute(expenseId: string, file: UploadedProof | undefined, dto: ExecutePaymentDto, actor: AuthUser): Promise<PaymentView> {
    try {
      if (!file?.size) throw new BadRequestException('Tải lên file ủy nhiệm chi trước khi hoàn thành chi');
      if (file.size > MAX_PROOF_SIZE) throw new BadRequestException('File ủy nhiệm chi tối đa 10 MB');
      const ext = proofExtension(file);
      if (!ext) throw new BadRequestException('File ủy nhiệm chi phải là PDF, JPG hoặc PNG');

      const id = await this.expensesRepository.manager.transaction(async (manager) => {
        const expense = await manager.findOne(ExpenseRequest, {
          where: { id: expenseId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!expense) throw new NotFoundException('Không tìm thấy yêu cầu chi');
        if (expense.status !== ExpenseStatus.DA_DUYET) {
          throw new ConflictException(
            `Chỉ hoàn thành chi hồ sơ đã được duyệt cuối (hiện tại: ${EXPENSE_STATUS_LABEL[expense.status]})`,
          );
        }
        const amount = (expense.amount ?? 0) - expense.paidAmount;
        if (amount <= 0) throw new ConflictException('Hồ sơ không còn số tiền cần chi');

        const tx = await manager.save(
          manager.create(PaymentTransaction, {
            code: await nextDocumentCode(manager, 'GD'),
            expenseId: expense.id,
            amount,
            paymentMethod: expense.paymentMethod,
            sourceAccount: null,
            bankName: null,
            bankRef: null,
            proofFileName: decodeFileName(file.originalname),
            proofData: file.buffer,
            proofMimeType: file.mimetype,
            proofSize: file.size,
            executedAt: todayVN(),
            executedById: actor.userId,
            note: dto.note ?? null,
          }),
        );

        expense.paidAmount = expense.amount ?? 0;
        expense.status = ExpenseStatus.DA_THANH_TOAN;
        await manager.save(expense);
        return tx.id;
      });
      const saved = await this.paymentsRepository.findOneOrFail({ where: { id }, relations: VIEW_RELATIONS });
      return toPaymentView(saved);
    } catch (error) {
      handleServiceError(error, this.logger, 'execute');
    }
  }

  /** GET /payments/:expenseId/proof: thông tin để trả file ủy nhiệm chi của hồ sơ */
  async getProof(expenseId: string): Promise<{ data: Buffer; fileName: string; mimeType: string }> {
    try {
      const tx = await this.paymentsRepository.findOne({
        where: { expenseId },
        // proofData là select: false nên phải chọn rõ
        select: { id: true, proofFileName: true, proofMimeType: true, proofData: true },
      });
      if (!tx?.proofData) throw new NotFoundException('Hồ sơ chưa có file ủy nhiệm chi');
      return {
        data: tx.proofData,
        fileName: tx.proofFileName ?? 'uy-nhiem-chi',
        mimeType: tx.proofMimeType ?? 'application/octet-stream',
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'getProof');
    }
  }
}

/** [ngày đầu tháng, ngày đầu tháng sau) dạng YYYY-MM-DD */
function monthRange(month: string): [string, string] {
  const [year, mon] = month.split('-').map(Number);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
  return [`${month}-01`, `${next}-01`];
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExpenseStatus, PaymentMethod } from '../../common/types.js';
import { numericTransformer } from '../../common/transformers.js';
import { Users } from '../../users/entity/users.entity.js';
import { Department } from '../../department/entity/department.entity.js';
import { Categories } from '../../categories/entity/categories.entity.js';
import { Project } from '../../budgets/entity/project.entity.js';
import { BudgetLine } from '../../budgets/entity/budget-line.entity.js';

/**
 * Yêu cầu chi (phiếu chi) – hồ sơ trung tâm của luồng duyệt (màn 08–15).
 * Bản nháp được lưu dù chưa đủ thông tin nên các cột nghiệp vụ cho phép null;
 * đủ thông tin được kiểm tra khi gửi duyệt (ExpensesService.assertReadyToSubmit).
 */
@Entity('ExpenseRequests')
@Index(['status'])
@Index(['departmentId', 'status'])
@Index(['requesterId'])
@Index(['budgetLineId'])
export class ExpenseRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Mã hiển thị, vd CHI-202611-0001. Cấp khi lưu lần đầu.
  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  // Nội dung / mục đích chi
  @Column({ type: 'text', nullable: true })
  purpose: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true, transformer: numericTransformer })
  amount: number | null;

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Categories, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Categories | null;

  // Phòng đề nghị: phòng của người tạo tại thời điểm tạo
  @Column({ type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  // Dòng ngân sách (đã bao gồm kỳ + khoản mục)
  @Column({ type: 'uuid', nullable: true })
  budgetLineId: string | null;

  @ManyToOne(() => BudgetLine, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'budgetLineId' })
  budgetLine: BudgetLine | null;

  @Column({ type: 'uuid' })
  requesterId: string;

  @ManyToOne(() => Users, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requesterId' })
  requester: Users;

  // Người thụ hưởng + tài khoản: lưu dạng chữ (bản chụp lúc gửi), chưa tham chiếu bảng Partners
  @Column({ type: 'varchar', length: 255, nullable: true })
  beneficiaryName: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  beneficiaryBankName: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  beneficiaryAccountNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  beneficiaryAccountName: string | null;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CHUYEN_KHOAN })
  paymentMethod: PaymentMethod;

  // Ngày cần chi
  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'enum', enum: ExpenseStatus, default: ExpenseStatus.NHAP })
  status: ExpenseStatus;

  // Tăng khi gửi lại sau yêu cầu bổ sung
  @Column({ type: 'int', default: 1 })
  version: number;

  // Tổng giao dịch chi thành công
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0, transformer: numericTransformer })
  paidAmount: number;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finalApprovedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Xóa mềm (chỉ cho xóa khi NHAP)
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

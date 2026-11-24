import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExpenseRequest } from './expense-request.entity.js';

/** Nội dung hồ sơ tại lúc gửi một phiên bản (để so sánh v1, v2... ở màn 10 / 14) */
export interface ExpenseSnapshot {
  purpose: string | null;
  amount: number | null;
  categoryName: string | null;
  projectName: string | null;
  budgetLineLabel: string | null;
  dueDate: string | null;
  beneficiaryName: string | null;
  beneficiaryBankName: string | null;
  beneficiaryAccountNumber: string | null;
  paymentMethod: string;
  note: string | null;
}

/** Bản chụp mỗi lần gửi duyệt: v1 lần gửi đầu, v2... mỗi lần gửi lại sau yêu cầu bổ sung */
@Entity('ExpenseRequestVersions')
@Index(['expenseId', 'version'], { unique: true })
export class ExpenseRequestVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  expenseId: string;

  @ManyToOne(() => ExpenseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expenseId' })
  expense: ExpenseRequest;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'jsonb' })
  snapshot: ExpenseSnapshot;

  @Column({ type: 'uuid', nullable: true })
  submittedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  submittedAt: Date;
}

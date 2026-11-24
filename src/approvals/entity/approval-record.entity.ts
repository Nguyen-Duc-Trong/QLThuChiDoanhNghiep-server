import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ApprovalDecision, ApprovalStep } from '../../common/types.js';
import { ExpenseRequest } from '../../expenses/entity/expense-request.entity.js';
import { Users } from '../../users/entity/users.entity.js';

/**
 * Một quyết định trong luồng duyệt chi (màn 11–13). Bất biến: chỉ thêm, không sửa / xóa.
 * Gắn với đúng phiên bản hồ sơ được xem xét (version).
 */
@Entity('ApprovalRecords')
@Index(['expenseId', 'createdAt'])
export class ApprovalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  expenseId: string;

  @ManyToOne(() => ExpenseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expenseId' })
  expense: ExpenseRequest;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'enum', enum: ApprovalStep })
  step: ApprovalStep;

  @Column({ type: 'enum', enum: ApprovalDecision })
  decision: ApprovalDecision;

  // Null khi hệ thống tự bỏ qua bước (BO_QUA)
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor: Users | null;

  // Người duyệt thay cho ai (khi duyệt theo ủy quyền)
  @Column({ type: 'uuid', nullable: true })
  onBehalfOfId: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'onBehalfOfId' })
  onBehalfOf: Users | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Yêu cầu bổ sung: các trường / chứng từ cần sửa
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  fields: string[];

  // Thẩm định kế toán: { documents: true, budget: true, ... }
  @Column({ type: 'jsonb', nullable: true })
  checklist: Record<string, boolean> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import { Users } from '../../users/entity/users.entity.js';
import { Department } from './department.entity.js';

/**
 * Ủy quyền phê duyệt (màn 22): trong khoảng [startDate, endDate], người được ủy quyền duyệt thay người ủy quyền.
 * - departmentId null = mọi phòng ban mà người ủy quyền phụ trách duyệt.
 * - maxAmount null = không giới hạn số tiền.
 * - Chỉ áp dụng cho phê duyệt, không áp dụng cho thực chi.
 * Không xóa cứng để giữ lịch sử: thu hồi = ghi revokedAt.
 */
@Entity('ApprovalDelegations')
@Index(['fromUserId', 'endDate'])
export class ApprovalDelegation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  fromUserId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fromUserId' })
  fromUser: Users;

  @Column({ type: 'uuid' })
  toUserId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'toUserId' })
  toUser: Users;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'departmentId' })
  department: Department | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true, transformer: numericTransformer })
  maxAmount: number | null;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

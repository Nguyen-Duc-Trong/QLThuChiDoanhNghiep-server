import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BudgetPeriodStatus } from '../../common/types.js';
import { numericTransformer } from '../../common/transformers.js';

/** Kỳ ngân sách (màn 17, 18). Chỉ kỳ MO mới nhận yêu cầu chi mới. */
@Entity('BudgetPeriods')
export class BudgetPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // vd Q4-2026
  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  // vd Quý IV/2026
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  // Tổng hạn mức được phân bổ trong kỳ
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0, transformer: numericTransformer })
  totalLimit: number;

  // % cảnh báo, vd 80
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 80, transformer: numericTransformer })
  warningThreshold: number;

  @Column({ type: 'enum', enum: BudgetPeriodStatus, default: BudgetPeriodStatus.NHAP })
  status: BudgetPeriodStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

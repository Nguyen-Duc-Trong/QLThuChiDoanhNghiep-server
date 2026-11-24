import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers.js';
import { Categories } from '../../categories/entity/categories.entity.js';
import { Department } from '../../department/entity/department.entity.js';
import { BudgetPeriod } from './budget-period.entity.js';

/**
 * Dòng ngân sách: phòng ban × khoản mục (danh mục CHI) × kỳ. Yêu cầu chi trừ vào một dòng.
 * Đã chi / cam kết / khả dụng KHÔNG lưu, tính khi truy vấn từ ExpenseRequests (BudgetsService.getUsage).
 */
@Entity('BudgetLines')
@Index(['periodId', 'departmentId', 'categoryId', 'name'], { unique: true })
export class BudgetLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  periodId: string;

  @ManyToOne(() => BudgetPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodId' })
  period: BudgetPeriod;

  @Column({ type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Categories, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Categories;

  // Tên riêng khi một khoản mục chia nhiều dòng, vd "Sản xuất video". Rỗng = dùng tên danh mục.
  @Column({ type: 'varchar', length: 255, default: '' })
  name: string;

  // Kế hoạch / hạn mức
  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  plannedAmount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

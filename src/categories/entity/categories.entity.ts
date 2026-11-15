import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryStatus, CategoryType } from '../../common/types.js';

/**
 * Danh mục thu / chi dùng chung toàn doanh nghiệp (màn 26–29).
 * Mã và tên là duy nhất trong cùng một loại (Thu hoặc Chi).
 */
@Entity('Categories')
@Index(['type', 'code'], { unique: true })
@Index(['type', 'name'], { unique: true })
export class Categories {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Mã danh mục, vd CHI-001. Lưu in hoa để kiểm tra trùng không phân biệt hoa thường.
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: CategoryType })
  type: CategoryType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: CategoryStatus, default: CategoryStatus.DANG_SU_DUNG })
  status: CategoryStatus;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

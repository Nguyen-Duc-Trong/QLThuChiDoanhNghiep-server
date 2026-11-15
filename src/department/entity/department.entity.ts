import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DepartmentKey } from '../../common/types.js';
import { Users } from '../../users/entity/users.entity.js';

@Entity('Departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Mã phòng ban (KE_TOAN, DEV...), mỗi mã chỉ có một phòng
  @Column({ type: 'enum', enum: DepartmentKey, unique: true })
  code: DepartmentKey;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Trưởng phòng: người duyệt chính ở bước "Trưởng phòng duyệt" của luồng Chi
  @Column({ type: 'uuid', nullable: true })
  headId: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'headId' })
  head: Users | null;

  // Người phụ trách duyệt: duyệt thay khi chính trưởng phòng tạo hồ sơ (quy tắc không tự duyệt).
  // Null -> phòng bị gắn cờ THIEU_NGUOI_DUYET (tính khi query, không lưu thành cột).
  @Column({ type: 'uuid', nullable: true })
  approverId: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approverId' })
  approver: Users | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProjectStatus } from '../../common/types.js';
import { Department } from '../../department/entity/department.entity.js';

/** Dự án: yêu cầu chi có thể gắn với một dự án (màn 09) */
@Entity('Projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Mã dự án, vd AV-2026-04
  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Phòng phụ trách
  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'departmentId' })
  department: Department | null;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.DANG_CHAY })
  status: ProjectStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Users } from '../../users/entity/users.entity.js';
import type { Permission } from '../permission-catalog.js';

export enum OverrideEffect {
  /** Cấp thêm quyền mà vai trò không có */
  GRANT = 'grant',
  /** Thu hồi quyền mà vai trò đang có */
  DENY = 'deny',
}

/**
 * Ngoại lệ phân quyền cho một người: cấp thêm hoặc thu hồi một quyền so với vai trò.
 * Quyền hiệu lực = quyền vai trò ∪ GRANT − DENY.
 */
@Entity('UserPermissionOverrides')
@Index(['userId', 'permission'], { unique: true })
export class UserPermissionOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Users;

  @Column({ type: 'varchar', length: 100 })
  permission: Permission;

  @Column({ type: 'enum', enum: OverrideEffect })
  effect: OverrideEffect;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  // Id người chỉnh gần nhất (để truy vết)
  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

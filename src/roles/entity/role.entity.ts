import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { RoleKey, type Permission } from '../../common/types.js';

/**
 * Một dòng = một vai trò + danh sách quyền của vai trò đó (một hàng của ma trận phân quyền).
 * Quyền lưu dạng mảng text để Admin sửa được ma trận mà không phải đổi code.
 */
@Entity('Roles')
export class Role {
  @PrimaryColumn({ type: 'enum', enum: RoleKey })
  key: RoleKey;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  // Phạm vi dữ liệu: Cá nhân / Phòng ban / Toàn công ty / Cấu hình hệ thống
  @Column({ type: 'varchar', length: 100 })
  scope: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  permissions: Permission[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

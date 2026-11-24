import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Cấu hình hệ thống dạng key – value (màn 22). Key hợp lệ và giá trị mặc định: SYSTEM_SETTING_DEFAULTS
 * trong settings.service.ts. Key chưa có dòng trong bảng thì dùng giá trị mặc định.
 */
@Entity('SystemSettings')
export class SystemSetting {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

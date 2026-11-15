import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Các quyền trong catalog đã được cấp mặc định cho vai trò (một lần duy nhất).
 * Nhờ bảng này, thêm quyền mới vào catalog thì lần khởi động sau vai trò mặc định tự có quyền đó,
 * còn quyền Admin đã cố ý tắt thì không bị bật lại.
 */
@Entity('SeededPermissions')
export class SeededPermission {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @CreateDateColumn({ type: 'timestamptz' })
  seededAt: Date;
}

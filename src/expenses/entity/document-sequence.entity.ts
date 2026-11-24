import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Bộ đếm sinh mã chứng từ theo tiền tố + kỳ (vd CHI + 202611).
 * Tăng bằng một câu INSERT ... ON CONFLICT DO UPDATE ... RETURNING nên không trùng khi nhiều người tạo cùng lúc.
 */
@Entity('DocumentSequences')
export class DocumentSequence {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  prefix: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  period: string;

  @Column({ type: 'int', default: 0 })
  lastNumber: number;
}

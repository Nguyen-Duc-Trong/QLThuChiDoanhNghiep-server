import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentMethod } from '../../common/types.js';
import { numericTransformer } from '../../common/transformers.js';
import { ExpenseRequest } from '../../expenses/entity/expense-request.entity.js';
import { Users } from '../../users/entity/users.entity.js';

/**
 * Lần "Hoàn thành chi" của kế toán (màn 15, 16). Bất biến: chỉ thêm, không sửa / xóa.
 * Mỗi yêu cầu chi được chi đúng một lần, đủ số tiền đã duyệt (unique expenseId).
 * Kế toán tải lên file ủy nhiệm chi (UNC, lưu trong cột proofData) rồi bấm Hoàn thành chi; tiền về người thụ hưởng là việc của ngân hàng, không đối soát.
 * sourceAccount / bankName / bankRef chỉ còn ở các lệnh chi cũ (trước khi đổi sang upload UNC).
 */
@Entity('PaymentTransactions')
@Index(['executedAt'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Mã hiển thị, vd GD-202611-0001
  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'uuid', unique: true })
  expenseId: string;

  @ManyToOne(() => ExpenseRequest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expenseId' })
  expense: ExpenseRequest;

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  // Nguồn tiền (lệnh chi cũ) — null với lệnh chi bằng file UNC
  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceAccount: string | null;

  // Ngân hàng thực hiện lệnh chuyển (null khi chi tiền mặt)
  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  // Mã giao dịch ngân hàng (lệnh chi cũ) – không trùng; null với lệnh chi bằng file UNC
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  bankRef: string | null;

  // File ủy nhiệm chi: tên gốc người dùng tải lên, loại và dung lượng (nội dung ở proofData)
  @Column({ type: 'varchar', length: 255, nullable: true })
  proofFileName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  proofMimeType: string | null;

  @Column({ type: 'int', nullable: true })
  proofSize: number | null;

  // Nội dung file ủy nhiệm chi, lưu ngay trong DB. select: false → không tải theo khi đọc danh sách / chi tiết
  @Column({ type: 'bytea', nullable: true, select: false })
  proofData: Buffer | null;

  // Ngày hoàn thành chi (giờ Việt Nam)
  @Column({ type: 'date' })
  executedAt: string;

  @Column({ type: 'uuid', nullable: true })
  executedById: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'executedById' })
  executedBy: Users | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

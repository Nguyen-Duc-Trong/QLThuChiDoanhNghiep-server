import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

/**
 * POST /payments/:expenseId (multipart/form-data) — kế toán Hoàn thành chi.
 * Field "file": file ủy nhiệm chi (bắt buộc, PDF / JPG / PNG, tối đa 10 MB). Field "note": ghi chú (tùy chọn).
 * Số tiền không nhận từ client: luôn chi đủ số tiền đã duyệt của hồ sơ.
 */
export class ExecutePaymentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú tối đa 1000 ký tự' })
  note?: string;
}

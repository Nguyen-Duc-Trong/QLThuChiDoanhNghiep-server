import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../common/types.js';

// Bản nháp được gửi lên cả khi chưa nhập: chuỗi rỗng coi như chưa có (null)
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return text === '' ? null : text;
};
const MAX_MONEY = 1_000_000_000_000_000;

/**
 * POST /expenses (tạo) và PATCH /expenses/:id (sửa nháp).
 * Mọi trường đều không bắt buộc để lưu nháp; route gửi duyệt (…/submit) mới kiểm tra đủ thông tin + ngân sách.
 */
export class SaveExpenseDto {
  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Nội dung chi không hợp lệ' })
  @MaxLength(2000, { message: 'Nội dung chi tối đa 2000 ký tự' })
  purpose?: string | null;

  @IsOptional()
  @IsInt({ message: 'Số tiền phải là số nguyên' })
  @Min(1, { message: 'Số tiền phải lớn hơn 0' })
  @Max(MAX_MONEY, { message: 'Số tiền quá lớn' })
  amount?: number | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsUUID('4', { message: 'Loại chi không hợp lệ' })
  categoryId?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsUUID('4', { message: 'Dự án không hợp lệ' })
  projectId?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsUUID('4', { message: 'Khoản mục ngân sách không hợp lệ' })
  budgetLineId?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsDateString({ strict: true }, { message: 'Ngày cần chi không hợp lệ' })
  dueDate?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Người thụ hưởng không hợp lệ' })
  @MaxLength(255, { message: 'Người thụ hưởng tối đa 255 ký tự' })
  beneficiaryName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Ngân hàng không hợp lệ' })
  @MaxLength(150, { message: 'Tên ngân hàng tối đa 150 ký tự' })
  beneficiaryBankName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^\d{6,20}$/, { message: 'Số tài khoản gồm 6–20 chữ số' })
  beneficiaryAccountNumber?: string | null;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Phương thức chi không hợp lệ' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(2000, { message: 'Ghi chú tối đa 2000 ký tự' })
  note?: string | null;
}

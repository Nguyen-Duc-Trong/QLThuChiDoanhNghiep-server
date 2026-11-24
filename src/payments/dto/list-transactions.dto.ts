import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PAYMENT_SOURCES } from '../../common/types.js';

const emptyToUndefined = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

/** GET /payments/transactions?page=1&limit=10&search=&month=2026-11&source=Quỹ chính */
export class ListTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(100, { message: 'limit tối đa là 100' })
  limit: number = 10;

  // Tìm theo mã giao dịch, mã yêu cầu chi, mã ngân hàng hoặc người thụ hưởng
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  // Tháng thực hiện chi, dạng YYYY-MM
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Tháng không hợp lệ (YYYY-MM)' })
  month?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(PAYMENT_SOURCES, { message: 'Nguồn tiền không hợp lệ' })
  source?: string;
}

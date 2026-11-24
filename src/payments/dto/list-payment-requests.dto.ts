import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ExpenseStatus } from '../../common/types.js';

const emptyToUndefined = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

/** Trạng thái hồ sơ thuộc phạm vi thanh toán: chờ chi và đã chi */
export const PAYMENT_REQUEST_STATUSES = [ExpenseStatus.DA_DUYET, ExpenseStatus.DA_THANH_TOAN] as const;

/** GET /payments/requests?page=1&limit=10&search=&status=DA_DUYET|DA_THANH_TOAN */
export class ListPaymentRequestsQueryDto {
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

  // Tìm theo mã, nội dung, người thụ hưởng hoặc người tạo
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(PAYMENT_REQUEST_STATUSES, { message: 'Trạng thái phải là DA_DUYET hoặc DA_THANH_TOAN' })
  status?: ExpenseStatus;
}

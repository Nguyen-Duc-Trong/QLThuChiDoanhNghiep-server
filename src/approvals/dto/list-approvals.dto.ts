import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ExpenseStatus } from '../../common/types.js';

const emptyToUndefined = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

/**
 * GET /approvals?page=1&limit=10&search=&status=&view=all|awaiting|approved
 * view=awaiting: chỉ hồ sơ đang chờ tôi quyết định; approved: hồ sơ tôi đã bấm Duyệt; all: mọi hồ sơ trong phạm vi tôi được xem (trừ nháp).
 */
export class ListApprovalsQueryDto {
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
  @IsEnum(ExpenseStatus, { message: 'Trạng thái không hợp lệ' })
  status?: ExpenseStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['all', 'awaiting', 'approved'], { message: 'view phải là all, awaiting hoặc approved' })
  view: 'all' | 'awaiting' | 'approved' = 'all';
}

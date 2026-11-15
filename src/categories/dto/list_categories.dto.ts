import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CategoryStatus, CategoryType } from '../../common/types.js';

// Query string rỗng (?type=&status=) coi như không lọc
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** GET /categories?page=1&limit=10&search=&type=CHI&status=DANG_SU_DUNG */
export class ListCategoriesQueryDto {
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

  // Tìm theo mã, tên hoặc mô tả
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  // Module áp dụng: THU / CHI
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(CategoryType, { message: 'type phải là THU hoặc CHI' })
  type?: CategoryType;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(CategoryStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CategoryStatus;
}

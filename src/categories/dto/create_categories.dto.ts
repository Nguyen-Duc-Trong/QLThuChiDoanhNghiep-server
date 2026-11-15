import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CategoryStatus, CategoryType } from '../../common/types.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** POST /categories */
export class CreateCategoriesDto {
  @IsEnum(CategoryType, { message: 'Module áp dụng phải là THU hoặc CHI' })
  type: CategoryType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Mã danh mục là bắt buộc' })
  @IsNotEmpty({ message: 'Mã danh mục là bắt buộc' })
  @MaxLength(20, { message: 'Mã danh mục tối đa 20 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới' })
  code: string;

  @Transform(trim)
  @IsString({ message: 'Tên danh mục là bắt buộc' })
  @IsNotEmpty({ message: 'Tên danh mục là bắt buộc' })
  @MaxLength(100, { message: 'Tên danh mục tối đa 100 ký tự' })
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Mô tả không hợp lệ' })
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;

  // Bỏ trống thì mặc định Đang sử dụng
  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CategoryStatus;
}

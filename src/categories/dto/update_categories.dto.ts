import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CategoryStatus } from '../../common/types.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * PATCH /categories/:id — chỉ gửi trường cần đổi.
 * Không cho sửa `type` (module) và `code`: đã có giao dịch tham chiếu thì đổi sẽ làm sai dữ liệu liên quan.
 */
export class UpdateCategoriesDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Tên danh mục không hợp lệ' })
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  @MaxLength(100, { message: 'Tên danh mục tối đa 100 ký tự' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Mô tả không hợp lệ' })
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;

  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'Trạng thái không hợp lệ' })
  status?: CategoryStatus;
}

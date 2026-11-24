import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { NotificationChannel } from '../settings.service.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// '' từ ô chọn "Chưa có" → null (bỏ gán)
const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

// ---------------------------------------------------------------------------
// Phòng ban
// ---------------------------------------------------------------------------

/** POST /departments */
export class CreateDepartmentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Mã phòng ban là bắt buộc' })
  @IsNotEmpty({ message: 'Mã phòng ban là bắt buộc' })
  @MaxLength(30, { message: 'Mã phòng ban tối đa 30 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới' })
  code: string;

  @Transform(trim)
  @IsString({ message: 'Tên phòng ban là bắt buộc' })
  @IsNotEmpty({ message: 'Tên phòng ban là bắt buộc' })
  @MaxLength(255, { message: 'Tên phòng ban tối đa 255 ký tự' })
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Mô tả không hợp lệ' })
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'Trưởng phòng không hợp lệ' })
  headId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'Người phụ trách duyệt không hợp lệ' })
  approverId?: string | null;
}

/** PATCH /departments/:id — chỉ gửi trường cần đổi */
export class UpdateDepartmentDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Mã phòng ban không hợp lệ' })
  @IsNotEmpty({ message: 'Mã phòng ban không được để trống' })
  @MaxLength(30, { message: 'Mã phòng ban tối đa 30 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới' })
  code?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Tên phòng ban không hợp lệ' })
  @IsNotEmpty({ message: 'Tên phòng ban không được để trống' })
  @MaxLength(255, { message: 'Tên phòng ban tối đa 255 ký tự' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Mô tả không hợp lệ' })
  @MaxLength(500, { message: 'Mô tả tối đa 500 ký tự' })
  description?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'Trưởng phòng không hợp lệ' })
  headId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'Người phụ trách duyệt không hợp lệ' })
  approverId?: string | null;
}

// ---------------------------------------------------------------------------
// Ủy quyền phê duyệt
// ---------------------------------------------------------------------------

/** POST /delegations */
export class CreateDelegationDto {
  @IsUUID('all', { message: 'Chọn người ủy quyền' })
  fromUserId: string;

  @IsUUID('all', { message: 'Chọn người được ủy quyền' })
  toUserId: string;

  // Bỏ trống = mọi phòng ban người ủy quyền phụ trách
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all', { message: 'Phòng ban không hợp lệ' })
  departmentId?: string | null;

  // Bỏ trống = không giới hạn số tiền
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsPositive({ message: 'Hạn mức phải lớn hơn 0' })
  @Max(1_000_000_000_000_000, { message: 'Hạn mức quá lớn' })
  maxAmount?: number | null;

  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate: string;

  @IsDateString({ strict: true }, { message: 'Ngày kết thúc không hợp lệ' })
  endDate: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}

// ---------------------------------------------------------------------------
// Cấu hình hệ thống
// ---------------------------------------------------------------------------

/** PUT /settings — chỉ gửi key cần đổi */
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['VND'], { message: 'Hiện chỉ hỗ trợ tiền tệ VND' })
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ngưỡng cảnh báo phải là số nguyên' })
  @Min(50, { message: 'Ngưỡng cảnh báo từ 50 đến 100%' })
  @Max(100, { message: 'Ngưỡng cảnh báo từ 50 đến 100%' })
  budgetWarningThreshold?: number;

  @IsOptional()
  @IsEnum(NotificationChannel, { message: 'Kênh thông báo không hợp lệ' })
  notificationChannel?: NotificationChannel;
}

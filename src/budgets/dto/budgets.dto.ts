import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BudgetPeriodStatus, ProjectStatus } from '../../common/types.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upperTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
// Tiền VND tối đa numeric(18,2) → giới hạn phần nguyên 16 chữ số; thực tế dùng 10^15
const MAX_MONEY = 1_000_000_000_000_000;

/** POST /projects */
export class CreateProjectDto {
  @Transform(upperTrim)
  @IsString({ message: 'Mã dự án là bắt buộc' })
  @IsNotEmpty({ message: 'Mã dự án là bắt buộc' })
  @MaxLength(30, { message: 'Mã dự án tối đa 30 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới' })
  code: string;

  @Transform(trim)
  @IsString({ message: 'Tên dự án là bắt buộc' })
  @IsNotEmpty({ message: 'Tên dự án là bắt buộc' })
  @MaxLength(255, { message: 'Tên dự án tối đa 255 ký tự' })
  name: string;

  @IsOptional()
  @IsUUID('4', { message: 'Phòng ban không hợp lệ' })
  departmentId?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Ngày kết thúc không hợp lệ' })
  endDate?: string;

  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Trạng thái dự án không hợp lệ' })
  status?: ProjectStatus;
}

/** POST /budget-periods */
export class CreateBudgetPeriodDto {
  @Transform(upperTrim)
  @IsString({ message: 'Mã kỳ là bắt buộc' })
  @IsNotEmpty({ message: 'Mã kỳ là bắt buộc' })
  @MaxLength(20, { message: 'Mã kỳ tối đa 20 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới' })
  code: string;

  @Transform(trim)
  @IsString({ message: 'Tên kỳ là bắt buộc' })
  @IsNotEmpty({ message: 'Tên kỳ là bắt buộc' })
  @MaxLength(100, { message: 'Tên kỳ tối đa 100 ký tự' })
  name: string;

  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate: string;

  @IsDateString({ strict: true }, { message: 'Ngày kết thúc không hợp lệ' })
  endDate: string;

  @IsInt({ message: 'Tổng hạn mức phải là số nguyên' })
  @Min(0, { message: 'Tổng hạn mức không được âm' })
  @Max(MAX_MONEY, { message: 'Tổng hạn mức quá lớn' })
  totalLimit: number;

  @IsOptional()
  @IsNumber({}, { message: 'Ngưỡng cảnh báo không hợp lệ' })
  @Min(1, { message: 'Ngưỡng cảnh báo từ 1 đến 100%' })
  @Max(100, { message: 'Ngưỡng cảnh báo từ 1 đến 100%' })
  warningThreshold?: number;

  @IsOptional()
  @IsEnum(BudgetPeriodStatus, { message: 'Trạng thái kỳ không hợp lệ' })
  status?: BudgetPeriodStatus;
}

/** POST /budget-lines */
export class CreateBudgetLineDto {
  @IsUUID('4', { message: 'Kỳ ngân sách không hợp lệ' })
  periodId: string;

  @IsUUID('4', { message: 'Phòng ban không hợp lệ' })
  departmentId: string;

  @IsUUID('4', { message: 'Khoản mục không hợp lệ' })
  categoryId: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Tên dòng ngân sách không hợp lệ' })
  @MaxLength(255, { message: 'Tên dòng ngân sách tối đa 255 ký tự' })
  name?: string;

  @IsInt({ message: 'Hạn mức phải là số nguyên' })
  @Min(1, { message: 'Hạn mức phải lớn hơn 0' })
  @Max(MAX_MONEY, { message: 'Hạn mức quá lớn' })
  plannedAmount: number;
}

/** GET /budget-lines?periodId&departmentId&categoryId */
export class ListBudgetLinesQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Kỳ ngân sách không hợp lệ' })
  periodId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Phòng ban không hợp lệ' })
  departmentId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Khoản mục không hợp lệ' })
  categoryId?: string;
}

/** GET /projects?status, GET /budget-periods?status */
export class ListProjectsQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Trạng thái dự án không hợp lệ' })
  status?: ProjectStatus;
}

export class ListBudgetPeriodsQueryDto {
  @IsOptional()
  @IsEnum(BudgetPeriodStatus, { message: 'Trạng thái kỳ không hợp lệ' })
  status?: BudgetPeriodStatus;
}

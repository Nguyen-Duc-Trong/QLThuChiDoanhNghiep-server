import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApprovalDecision, ApprovalStep } from '../../common/types.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * POST /approvals/:id/decision
 * step + version: bước và phiên bản hồ sơ người duyệt đang xem; khác hiện trạng thì 409 (tránh quyết định trên dữ liệu cũ).
 */
export class DecideDto {
  @IsIn([ApprovalDecision.DUYET, ApprovalDecision.BO_SUNG, ApprovalDecision.TU_CHOI], {
    message: 'Quyết định phải là DUYET, BO_SUNG hoặc TU_CHOI',
  })
  decision: ApprovalDecision.DUYET | ApprovalDecision.BO_SUNG | ApprovalDecision.TU_CHOI;

  @IsIn(Object.values(ApprovalStep), { message: 'Bước duyệt không hợp lệ' })
  step: ApprovalStep;

  @IsInt({ message: 'Phiên bản không hợp lệ' })
  @Min(1)
  version: number;

  // Bắt buộc với BO_SUNG / TU_CHOI (service kiểm tra)
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(2000, { message: 'Ghi chú tối đa 2000 ký tự' })
  note?: string;

  // Yêu cầu bổ sung: các trường / chứng từ cần sửa
  @IsOptional()
  @IsArray({ message: 'Danh sách trường cần sửa không hợp lệ' })
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  fields?: string[];

  // Thẩm định kế toán: { documents: true, budget: true, ... } — giá trị không phải boolean bị coi là false
  @IsOptional()
  @IsObject({ message: 'Checklist không hợp lệ' })
  @Transform(({ value }) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 20).map(([k, v]) => [k.slice(0, 50), v === true]))
      : value,
  )
  checklist?: Record<string, boolean>;
}

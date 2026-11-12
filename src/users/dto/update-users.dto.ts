import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { RoleKey, UserStatus } from '../../common/types.js';

export class UpdateUsersDto {
  @IsUUID('all', { message: 'ID người dùng không hợp lệ' })
  id: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  // Bỏ trống thì giữ nguyên mật khẩu cũ
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password?: string;

  @IsOptional()
  @IsEnum(UserStatus, { message: 'Trạng thái không hợp lệ' })
  status?: UserStatus;

  @IsOptional()
  @IsEnum(RoleKey, { message: 'Vai trò không hợp lệ' })
  role?: RoleKey;
}

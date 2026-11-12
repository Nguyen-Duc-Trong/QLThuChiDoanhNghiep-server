import { IsArray, IsEnum } from 'class-validator';
import { Permission } from '../../common/types.js';

export class UpdateRolePermissionsDto {
  @IsArray({ message: 'permissions phải là một mảng' })
  @IsEnum(Permission, { each: true, message: 'Quyền không hợp lệ' })
  permissions: Permission[];
}

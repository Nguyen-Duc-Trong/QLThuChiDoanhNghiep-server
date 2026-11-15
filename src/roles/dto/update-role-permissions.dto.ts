import { IsArray, IsIn } from 'class-validator';
import { ALL_PERMISSIONS, type Permission } from '../../permissions/permission-catalog.js';

export class UpdateRolePermissionsDto {
  @IsArray({ message: 'permissions phải là một mảng' })
  @IsIn(ALL_PERMISSIONS, { each: true, message: 'Quyền không hợp lệ' })
  permissions: Permission[];
}

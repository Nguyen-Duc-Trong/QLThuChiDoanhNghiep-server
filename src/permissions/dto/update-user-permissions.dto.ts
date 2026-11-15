import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ALL_PERMISSIONS, type Permission } from '../permission-catalog.js';
import { OverrideEffect } from '../entity/user-permission-override.entity.js';

export class OverrideItemDto {
  @IsIn(ALL_PERMISSIONS, { message: 'Quyền không hợp lệ' })
  permission: Permission;

  @IsEnum(OverrideEffect, { message: 'effect phải là grant hoặc deny' })
  effect: OverrideEffect;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  reason?: string;
}

/** PUT /users/:id/permissions – thay toàn bộ ngoại lệ quyền của một người */
export class UpdateUserPermissionsDto {
  @IsArray({ message: 'overrides phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => OverrideItemDto)
  overrides: OverrideItemDto[];
}

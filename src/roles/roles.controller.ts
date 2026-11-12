import { BadRequestException, Body, Controller, Get, Param, ParseEnumPipe, Put } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto.js';
import { ResponseMessage } from '../common/response.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission, RoleKey } from '../common/types.js';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Danh sách vai trò + ma trận quyền (màn 21, và dropdown vai trò ở màn 20)
  @Get()
  @RequirePermissions(Permission.USERS)
  @ResponseMessage('Lấy danh sách vai trò thành công')
  findAll() {
    return this.rolesService.findAll();
  }

  @Put(':key/permissions')
  @RequirePermissions(Permission.CONFIG)
  @ResponseMessage('Cập nhật quyền thành công')
  updatePermissions(
    @Param('key', new ParseEnumPipe(RoleKey, { exceptionFactory: () => new BadRequestException('Vai trò không hợp lệ') }))
    key: RoleKey,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(key, dto.permissions);
  }
}

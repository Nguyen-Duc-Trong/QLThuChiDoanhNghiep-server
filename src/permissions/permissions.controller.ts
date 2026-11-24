import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ResponseMessage } from '../common/response.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { PermissionsService } from './permissions.service.js';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto.js';
import { EmitsWorkflowChange } from '../notifications/workflow-change.js';

@Controller()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // Danh mục quyền theo module: client dựng tab/cột màn phân quyền. Ai đăng nhập cũng đọc được.
  @Get('permissions/catalog')
  @ResponseMessage('Lấy danh mục quyền thành công')
  catalog() {
    return this.permissionsService.getCatalog();
  }

  // { [userId]: số ngoại lệ } để gắn nhãn "Có quyền riêng" trong danh sách người dùng
  @Get('permissions/overrides/summary')
  @RequirePermissions('admin.users')
  @ResponseMessage('Lấy thống kê quyền riêng thành công')
  overridesSummary() {
    return this.permissionsService.countOverridesByUser();
  }

  @Get('users/:id/permissions')
  @RequirePermissions('admin.users')
  @ResponseMessage('Lấy quyền của người dùng thành công')
  getUserPermissions(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.permissionsService.getUserPermissions(id);
  }

  @EmitsWorkflowChange('user.permissions')
  @Put('users/:id/permissions')
  @RequirePermissions('admin.roles')
  @ResponseMessage('Cập nhật quyền riêng thành công')
  updateUserPermissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.permissionsService.setUserOverrides(id, dto.overrides, actor.userId);
  }
}

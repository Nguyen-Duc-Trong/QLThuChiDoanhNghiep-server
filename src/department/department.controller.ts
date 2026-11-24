import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { ResponseMessage } from '../common/response.js';
import { DelegationsService } from './delegations.service.js';
import { DepartmentService } from './department.service.js';
import {
  CreateDelegationDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  UpdateSettingsDto,
} from './dto/department.dto.js';
import { SettingsService } from './settings.service.js';
import { EmitsWorkflowChange } from '../notifications/workflow-change.js';

const uuidPipe = (label: string) =>
  new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException(`ID ${label} không hợp lệ`) });

/** Màn 22 · Phòng ban, ủy quyền phê duyệt và cấu hình hệ thống */
@Controller()
@RequirePermissions('admin.departments')
export class DepartmentController {
  constructor(
    private readonly departmentService: DepartmentService,
    private readonly delegationsService: DelegationsService,
    private readonly settingsService: SettingsService,
  ) {}

  // ----- Phòng ban -----

  @Get('departments')
  @ResponseMessage('Lấy danh sách phòng ban thành công')
  findAll() {
    return this.departmentService.findAll();
  }

  // Người dùng đang hoạt động để chọn trưởng phòng / người duyệt / người ủy quyền
  @Get('departments/form-options')
  @ResponseMessage('Lấy dữ liệu biểu mẫu thành công')
  formOptions() {
    return this.departmentService.getStaffOptions();
  }

  @Get('departments/:id')
  @ResponseMessage('Lấy thông tin phòng ban thành công')
  findOne(@Param('id', uuidPipe('phòng ban')) id: string) {
    return this.departmentService.findOne(id);
  }

  @EmitsWorkflowChange('department.create')
  @Post('departments')
  @ResponseMessage('Tạo phòng ban thành công')
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentService.create(dto);
  }

  @EmitsWorkflowChange('department.update')
  @Patch('departments/:id')
  @ResponseMessage('Cập nhật phòng ban thành công')
  update(@Param('id', uuidPipe('phòng ban')) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentService.update(id, dto);
  }

  @EmitsWorkflowChange('department.remove')
  @Delete('departments/:id')
  @ResponseMessage('Xóa phòng ban thành công')
  remove(@Param('id', uuidPipe('phòng ban')) id: string) {
    return this.departmentService.remove(id);
  }

  // ----- Ủy quyền phê duyệt -----

  @Get('delegations')
  @ResponseMessage('Lấy danh sách ủy quyền thành công')
  findDelegations() {
    return this.delegationsService.findAll();
  }

  @EmitsWorkflowChange('delegation.create')
  @Post('delegations')
  @ResponseMessage('Tạo ủy quyền thành công')
  createDelegation(@Body() dto: CreateDelegationDto, @CurrentUser() actor: AuthUser) {
    return this.delegationsService.create(dto, actor.userId);
  }

  @EmitsWorkflowChange('delegation.revoke')
  @Delete('delegations/:id')
  @ResponseMessage('Thu hồi ủy quyền thành công')
  revokeDelegation(@Param('id', uuidPipe('ủy quyền')) id: string, @CurrentUser() actor: AuthUser) {
    return this.delegationsService.revoke(id, actor.userId);
  }

  // ----- Cấu hình hệ thống -----

  @Get('settings')
  @ResponseMessage('Lấy cấu hình hệ thống thành công')
  getSettings() {
    return this.settingsService.getView();
  }

  @Put('settings')
  @ResponseMessage('Lưu cấu hình hệ thống thành công')
  updateSettings(@Body() dto: UpdateSettingsDto, @CurrentUser() actor: AuthUser) {
    return this.settingsService.update(dto, actor.userId);
  }
}

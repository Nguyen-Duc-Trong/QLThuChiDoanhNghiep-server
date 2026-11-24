import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DelegationsService } from './delegations.service.js';
import { DepartmentController } from './department.controller.js';
import { DepartmentService } from './department.service.js';
import { ApprovalDelegation } from './entity/approval-delegation.entity.js';
import { Department } from './entity/department.entity.js';
import { SystemSetting } from './entity/system-setting.entity.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Department, ApprovalDelegation, SystemSetting])],
  controllers: [DepartmentController],
  providers: [DepartmentService, DelegationsService, SettingsService],
  // DelegationsService.findActiveDelegate cho luồng phê duyệt, SettingsService.getSettings cho ngân sách
  exports: [DepartmentService, DelegationsService, SettingsService],
})
export class DepartmentModule {}

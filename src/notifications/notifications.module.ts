import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { WorkflowChangeInterceptor, WorkflowEvents } from './workflow-change.js';

/**
 * Global để mọi module dùng được WorkflowEvents mà không phải import (tránh vòng phụ thuộc với ApprovalsModule).
 * Các route nghiệp vụ chỉ cần gắn @EmitsWorkflowChange(...).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ExpenseRequest]), ApprovalsModule, PermissionsModule],
  controllers: [NotificationsController],
  providers: [
    WorkflowEvents,
    NotificationsService,
    { provide: APP_INTERCEPTOR, useClass: WorkflowChangeInterceptor },
  ],
  exports: [WorkflowEvents],
})
export class NotificationsModule {}

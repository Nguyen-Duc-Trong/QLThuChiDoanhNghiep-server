import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetsModule } from '../budgets/budgets.module.js';
import { DepartmentModule } from '../department/department.module.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { ApprovalWorkflowService } from './approval-workflow.service.js';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalRecord } from './entity/approval-record.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRecord, ExpenseRequest]), BudgetsModule, DepartmentModule, PermissionsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalWorkflowService],
  exports: [ApprovalWorkflowService],
})
export class ApprovalsModule {}

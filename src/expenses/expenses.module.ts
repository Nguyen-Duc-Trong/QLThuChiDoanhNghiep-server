import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetsModule } from '../budgets/budgets.module.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { ExpenseRequestVersion } from './entity/expense-request-version.entity.js';
import { DocumentSequence } from './entity/document-sequence.entity.js';
import { ExpenseRequest } from './entity/expense-request.entity.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseRequest, DocumentSequence, ExpenseRequestVersion]), BudgetsModule, ApprovalsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}

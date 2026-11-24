import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../department/entity/department.entity.js';
import { BudgetsController } from './budgets.controller.js';
import { BudgetsService } from './budgets.service.js';
import { BudgetLine } from './entity/budget-line.entity.js';
import { BudgetPeriod } from './entity/budget-period.entity.js';
import { Project } from './entity/project.entity.js';

@Module({
  // Department chưa có module riêng: đăng ký ở đây để TypeORM nạp metadata (dòng ngân sách / dự án tham chiếu phòng ban)
  imports: [TypeOrmModule.forFeature([Project, BudgetPeriod, BudgetLine, Department])],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}

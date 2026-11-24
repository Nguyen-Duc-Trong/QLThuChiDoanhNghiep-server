import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequireAnyPermission, RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { ResponseMessage } from '../common/response.js';
import { BudgetsService } from './budgets.service.js';
import {
  CreateBudgetLineDto,
  CreateBudgetPeriodDto,
  CreateProjectDto,
  ListBudgetLinesQueryDto,
  ListBudgetPeriodsQueryDto,
  ListProjectsQueryDto,
} from './dto/budgets.dto.js';

/**
 * Dữ liệu nền cho ngân sách: dự án, kỳ ngân sách, dòng ngân sách.
 * Xem: người có menu ngân sách hoặc được tạo yêu cầu chi. Thêm mới: quyền "budget.allocate".
 */
@Controller()
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  // GET /projects?status=DANG_CHAY
  @Get('projects')
  @RequireAnyPermission('budget.menu', 'expense.create')
  @ResponseMessage('Lấy danh sách dự án thành công')
  listProjects(@Query() query: ListProjectsQueryDto) {
    return this.budgetsService.listProjects(query);
  }

  @Post('projects')
  @RequirePermissions('budget.allocate')
  @ResponseMessage('Tạo dự án thành công')
  createProject(@Body() dto: CreateProjectDto) {
    return this.budgetsService.createProject(dto);
  }

  // GET /budget-periods?status=MO
  @Get('budget-periods')
  @RequireAnyPermission('budget.menu', 'expense.create')
  @ResponseMessage('Lấy danh sách kỳ ngân sách thành công')
  listPeriods(@Query() query: ListBudgetPeriodsQueryDto) {
    return this.budgetsService.listPeriods(query);
  }

  @Post('budget-periods')
  @RequirePermissions('budget.allocate')
  @ResponseMessage('Tạo kỳ ngân sách thành công')
  createPeriod(@Body() dto: CreateBudgetPeriodDto) {
    return this.budgetsService.createPeriod(dto);
  }

  // GET /budget-lines?periodId&departmentId&categoryId — kèm kế hoạch / đã chi / cam kết / khả dụng
  @Get('budget-lines')
  @RequirePermissions('budget.menu')
  @ResponseMessage('Lấy danh sách dòng ngân sách thành công')
  listLines(@Query() query: ListBudgetLinesQueryDto) {
    return this.budgetsService.listLines(query);
  }

  @Post('budget-lines')
  @RequirePermissions('budget.allocate')
  @ResponseMessage('Tạo dòng ngân sách thành công')
  createLine(@Body() dto: CreateBudgetLineDto) {
    return this.budgetsService.createLine(dto);
  }
}

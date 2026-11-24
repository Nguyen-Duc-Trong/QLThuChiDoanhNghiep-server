import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { RequireAnyPermission, RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { ResponseMessage } from '../common/response.js';
import { ExpensesService } from './expenses.service.js';
import { SaveExpenseDto } from './dto/save-expense.dto.js';
import { ListExpensesQueryDto } from './dto/list-expenses.dto.js';
import { EmitsWorkflowChange } from '../notifications/workflow-change.js';

const uuidPipe = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID yêu cầu chi không hợp lệ') });

/**
 * Yêu cầu chi (phiếu chi).
 * Lưu nháp: POST /expenses, PATCH /expenses/:id.
 * Gửi phê duyệt: POST /expenses/submit (tạo + gửi), POST /expenses/:id/submit (lưu + gửi bản nháp đã có)
 * – route riêng để guard kiểm tra thêm quyền "expense.submit".
 */
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // Dữ liệu cho form tạo: phòng ban, loại chi, dự án, kỳ đang mở, dòng ngân sách + khả dụng
  @Get('form-options')
  @RequireAnyPermission('expense.create', 'expense.edit')
  @ResponseMessage('Lấy dữ liệu form yêu cầu chi thành công')
  getFormOptions(@CurrentUser() actor: AuthUser) {
    return this.expensesService.getFormOptions(actor);
  }

  // Yêu cầu chi của tôi (màn 08)
  @Get()
  @RequirePermissions('expense.menu')
  @ResponseMessage('Lấy danh sách yêu cầu chi thành công')
  listMine(@Query() query: ListExpensesQueryDto, @CurrentUser() actor: AuthUser) {
    return this.expensesService.listMine(query, actor);
  }

  @Get('stats')
  @RequirePermissions('expense.menu')
  @ResponseMessage('Lấy thống kê yêu cầu chi thành công')
  statsMine(@CurrentUser() actor: AuthUser) {
    return this.expensesService.statsMine(actor);
  }

  @EmitsWorkflowChange('expense.create')
  @Post()
  @RequirePermissions('expense.create')
  @ResponseMessage('Đã lưu nháp yêu cầu chi')
  create(@Body() dto: SaveExpenseDto, @CurrentUser() actor: AuthUser) {
    return this.expensesService.create(dto, actor, false);
  }

  @EmitsWorkflowChange('expense.submit')
  @Post('submit')
  @RequirePermissions('expense.create', 'expense.submit')
  @ResponseMessage('Đã gửi yêu cầu chi phê duyệt')
  createAndSubmit(@Body() dto: SaveExpenseDto, @CurrentUser() actor: AuthUser) {
    return this.expensesService.create(dto, actor, true);
  }

  // Nhận id hoặc mã CHI-YYYYMM-XXXX. Người duyệt / kế toán / lãnh đạo cũng xem được (service kiểm tra phạm vi)
  @Get(':idOrCode')
  @ResponseMessage('Lấy thông tin yêu cầu chi thành công')
  findOne(@Param('idOrCode') idOrCode: string, @CurrentUser() actor: AuthUser) {
    if (!/^[0-9a-f-]{36}$/i.test(idOrCode) && !/^CHI-\d{6}-\d{4,}$/i.test(idOrCode)) {
      throw new BadRequestException('Mã yêu cầu chi không hợp lệ');
    }
    return this.expensesService.findOne(idOrCode, actor);
  }

  @EmitsWorkflowChange('expense.update')
  @Patch(':id')
  @RequireAnyPermission('expense.create', 'expense.edit')
  @ResponseMessage('Đã lưu nháp yêu cầu chi')
  update(@Param('id', uuidPipe) id: string, @Body() dto: SaveExpenseDto, @CurrentUser() actor: AuthUser) {
    return this.expensesService.update(id, dto, actor, false);
  }

  @EmitsWorkflowChange('expense.cancel')
  @Post(':id/cancel')
  @RequireAnyPermission('expense.delete', 'expense.edit')
  @ResponseMessage('Đã hủy yêu cầu chi')
  cancel(@Param('id', uuidPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.expensesService.cancel(id, actor);
  }

  // Gửi bản nháp, hoặc gửi lại hồ sơ Cần bổ sung (tạo phiên bản mới)
  @EmitsWorkflowChange('expense.resubmit')
  @Post(':id/submit')
  @RequirePermissions('expense.submit')
  @ResponseMessage('Đã gửi yêu cầu chi phê duyệt')
  submit(@Param('id', uuidPipe) id: string, @Body() dto: SaveExpenseDto, @CurrentUser() actor: AuthUser) {
    return this.expensesService.update(id, dto, actor, true);
  }
}

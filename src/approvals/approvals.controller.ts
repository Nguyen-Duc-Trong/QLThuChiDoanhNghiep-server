import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ListApprovalsQueryDto } from './dto/list-approvals.dto.js';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ResponseMessage } from '../common/response.js';
import { ApprovalWorkflowService } from './approval-workflow.service.js';
import { DecideDto } from './dto/decide.dto.js';
import { EmitsWorkflowChange } from '../notifications/workflow-change.js';

const uuidPipe = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID yêu cầu chi không hợp lệ') });

/**
 * Phê duyệt chi 3 cấp (màn 11–13). Người được ủy quyền duyệt có thể không có quyền approval.* riêng,
 * nên route chỉ cần đăng nhập; service kiểm tra đúng người duyệt của từng bước.
 */
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly workflowService: ApprovalWorkflowService) {}

  // Danh sách mọi hồ sơ trong phạm vi được xem (đủ trạng thái), hồ sơ chờ tôi lên đầu
  @Get()
  @ResponseMessage('Lấy danh sách phê duyệt thành công')
  list(@Query() query: ListApprovalsQueryDto, @CurrentUser() actor: AuthUser) {
    return this.workflowService.listForActor(query, actor);
  }

  @Get('queue')
  @ResponseMessage('Lấy hàng chờ phê duyệt thành công')
  queue(@CurrentUser() actor: AuthUser) {
    return this.workflowService.getQueue(actor);
  }

  @EmitsWorkflowChange('approval.decide')
  @Post(':id/decision')
  @ResponseMessage('Đã ghi nhận quyết định')
  decide(@Param('id', uuidPipe) id: string, @Body() dto: DecideDto, @CurrentUser() actor: AuthUser) {
    return this.workflowService.decide(id, dto, actor);
  }
}

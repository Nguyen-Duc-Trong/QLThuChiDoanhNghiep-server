import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ResponseMessage } from '../common/response.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Số thông báo trên menu (Phê duyệt, Thanh toán). Chỉ cần đăng nhập; số tính theo đúng người đang đăng nhập.
 * Client mở EventSource tới /api/notifications/stream (cookie accessToken gửi kèm).
 * Sự kiện: `counts` (data: { approvals, payments }), `ping` (giữ kết nối).
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse('stream')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.notificationsService.stream(user);
  }

  @Get('counts')
  @ResponseMessage('Lấy số thông báo thành công')
  counts(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getCounts(user);
  }
}

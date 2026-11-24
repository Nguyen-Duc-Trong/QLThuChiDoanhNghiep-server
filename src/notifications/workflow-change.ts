import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, Subject, tap } from 'rxjs';

/**
 * Kênh nội bộ báo "dữ liệu luồng duyệt / thực chi vừa đổi" (hồ sơ được gửi, duyệt, chi; ủy quyền, phòng ban, quyền...).
 * NotificationsService nghe kênh này để tính lại số trên menu và đẩy cho người đang kết nối.
 * Tách riêng, không phụ thuộc module nào, để các module nghiệp vụ không phải import NotificationsModule (tránh vòng phụ thuộc).
 */
@Injectable()
export class WorkflowEvents {
  private readonly subject = new Subject<string>();
  readonly changes$ = this.subject.asObservable();

  emit(reason: string): void {
    this.subject.next(reason);
  }
}

const WORKFLOW_CHANGE_KEY = 'workflowChange';

/**
 * Gắn vào route làm thay đổi hàng chờ phê duyệt / hồ sơ chờ chi.
 * Request thành công → WorkflowChangeInterceptor phát sự kiện; request lỗi thì không phát.
 *
 * Ví dụ: @EmitsWorkflowChange('approval.decide')
 */
export const EmitsWorkflowChange = (reason: string) => SetMetadata(WORKFLOW_CHANGE_KEY, reason);

/** Interceptor global: route có @EmitsWorkflowChange chạy xong thành công thì phát sự kiện */
@Injectable()
export class WorkflowChangeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly events: WorkflowEvents,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const reason = this.reflector.get<string | undefined>(WORKFLOW_CHANGE_KEY, context.getHandler());
    if (!reason) return next.handle();
    return next.handle().pipe(tap({ complete: () => this.events.emit(reason) }));
  }
}

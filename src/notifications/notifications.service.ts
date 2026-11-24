import { Injectable, Logger, MessageEvent, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subscriber, Subscription, debounceTime } from 'rxjs';
import { Repository } from 'typeorm';
import { ApprovalWorkflowService } from '../approvals/approval-workflow.service.js';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { ExpenseStatus } from '../common/types.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { WorkflowEvents } from './workflow-change.js';

/** Số trên menu: hồ sơ chờ tôi duyệt, hồ sơ chờ thực chi (chỉ người có quyền payment.execute) */
export interface MenuCounts {
  approvals: number;
  payments: number;
}

interface Connection {
  user: AuthUser;
  subscriber: Subscriber<MessageEvent>;
  lastSent: string | null;
}

// Gửi ping định kỳ để proxy / trình duyệt không đóng kết nối nhàn rỗi
const HEARTBEAT_MS = 25_000;
// Gộp nhiều thay đổi liên tiếp (vd duyệt hàng loạt) thành một lần tính lại
const RECOMPUTE_DEBOUNCE_MS = 300;

/**
 * Thông báo thời gian thực qua Server-Sent Events (GET /notifications/stream).
 * - Kết nối mới: gửi ngay số hiện tại.
 * - Có sự kiện WorkflowEvents: tính lại số cho mọi người đang kết nối, chỉ gửi cho người có số thay đổi.
 * Lưu kết nối trong bộ nhớ: đủ cho một tiến trình server; chạy nhiều instance thì cần chuyển sự kiện qua Redis pub/sub.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly connections = new Set<Connection>();
  private subscription?: Subscription;

  constructor(
    private readonly events: WorkflowEvents,
    private readonly workflowService: ApprovalWorkflowService,
    private readonly permissionsService: PermissionsService,
    @InjectRepository(ExpenseRequest)
    private readonly expensesRepository: Repository<ExpenseRequest>,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events.changes$
      .pipe(debounceTime(RECOMPUTE_DEBOUNCE_MS))
      .subscribe(() => void this.pushToAll());
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    for (const conn of this.connections) conn.subscriber.complete();
    this.connections.clear();
  }

  /** Luồng SSE của một người; đóng tab / mất mạng thì teardown tự gỡ kết nối */
  stream(user: AuthUser): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const conn: Connection = { user, subscriber, lastSent: null };
      this.connections.add(conn);
      void this.push([conn]);
      const heartbeat = setInterval(() => subscriber.next({ type: 'ping', data: String(Date.now()) }), HEARTBEAT_MS);
      return () => {
        clearInterval(heartbeat);
        this.connections.delete(conn);
      };
    });
  }

  /** GET /notifications/counts: số hiện tại (dùng khi không mở được SSE) */
  async getCounts(user: AuthUser): Promise<MenuCounts> {
    return (await this.computeCounts([user])).get(user.userId)!;
  }

  private async pushToAll(): Promise<void> {
    if (this.connections.size > 0) await this.push([...this.connections]);
  }

  private async push(conns: Connection[]): Promise<void> {
    try {
      const counts = await this.computeCounts(conns.map((c) => c.user));
      for (const conn of conns) {
        if (conn.subscriber.closed) continue;
        const data = counts.get(conn.user.userId)!;
        const json = JSON.stringify(data);
        if (json === conn.lastSent) continue;
        conn.lastSent = json;
        conn.subscriber.next({ type: 'counts', data });
      }
    } catch (error) {
      this.logger.error('Không tính được số thông báo', error instanceof Error ? error.stack : String(error));
    }
  }

  private async computeCounts(users: AuthUser[]): Promise<Map<string, MenuCounts>> {
    const userIds = [...new Set(users.map((u) => u.userId))];
    const [approvals, pendingPayments, payers] = await Promise.all([
      this.workflowService.countQueues(userIds),
      this.expensesRepository.count({ where: { status: ExpenseStatus.DA_DUYET } }),
      this.findPayers(users),
    ]);
    return new Map(
      userIds.map((id) => [id, { approvals: approvals.get(id) ?? 0, payments: payers.has(id) ? pendingPayments : 0 }]),
    );
  }

  /** Người có quyền thực chi (quyền hiệu lực: vai trò + ngoại lệ riêng, có cache Redis) */
  private async findPayers(users: AuthUser[]): Promise<Set<string>> {
    const unique = [...new Map(users.map((u) => [u.userId, u])).values()];
    const checks = await Promise.all(
      unique.map(async (u) => ((await this.permissionsService.getEffective(u.userId, u.role)).includes('payment.execute') ? u.userId : null)),
    );
    return new Set(checks.filter((id): id is string => id !== null));
  }
}

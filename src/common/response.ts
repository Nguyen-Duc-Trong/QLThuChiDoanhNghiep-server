import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

/**
 * Định dạng response chung cho toàn bộ API.
 *
 * Thành công:
 * { success: true, statusCode: 200, message: 'Thành công', data: {...}, meta?: {...}, timestamp, path }
 *
 * Lỗi:
 * { success: false, statusCode: 400, message: 'Dữ liệu không hợp lệ', errors?: [...], timestamp, path }
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: unknown;
  timestamp: string;
  path: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Dữ liệu phân trang: controller trả về `paginate(items, total, page, limit)` */
export class PaginatedResult<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: PaginationMeta,
  ) {}
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return new PaginatedResult(items, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

// ---------------------------------------------------------------------------
// @ResponseMessage('...') — đặt message tuỳ chỉnh cho từng route
// ---------------------------------------------------------------------------
const RESPONSE_MESSAGE_KEY = 'response_message';

export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);

// ---------------------------------------------------------------------------
// Interceptor: bọc mọi kết quả thành công vào ApiResponse
// ---------------------------------------------------------------------------
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [context.getHandler(), context.getClass()]) ??
      'Thành công';

    return next.handle().pipe(
      map((result) => {
        const base = {
          success: true,
          statusCode: response.statusCode,
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
        };

        if (result instanceof PaginatedResult) {
          return { ...base, data: result.items as T, meta: result.meta };
        }
        return { ...base, data: result ?? null } as ApiResponse<T>;
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Exception filter: trả lỗi theo cùng định dạng ApiResponse
// ---------------------------------------------------------------------------
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi hệ thống, vui lòng thử lại sau';
    let errors: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as { message?: string | string[] };
        // ValidationPipe trả về message là mảng các lỗi
        if (Array.isArray(body.message)) {
          message = 'Dữ liệu không hợp lệ';
          errors = body.message;
        } else if (body.message) {
          message = body.message;
        }
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const payload: ApiResponse<null> = {
      success: false,
      statusCode,
      message,
      ...(errors !== undefined && { errors }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(payload);
  }
}

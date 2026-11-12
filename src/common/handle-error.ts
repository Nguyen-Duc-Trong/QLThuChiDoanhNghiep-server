import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Mã lỗi PostgreSQL thường gặp
const PG_UNIQUE_VIOLATION = '23505';
const PG_INVALID_TEXT_REPRESENTATION = '22P02'; // vd: truyền chuỗi không phải uuid vào cột uuid

/**
 * Xử lý lỗi chung trong khối catch của service:
 * - Lỗi nghiệp vụ (HttpException: 404, 409, 401...) → ném lại nguyên vẹn
 * - Lỗi DB đã biết → đổi sang HttpException phù hợp
 * - Lỗi khác → ghi log và trả 500, không lộ chi tiết ra client
 */
export function handleServiceError(error: unknown, logger: Logger, context: string): never {
  if (error instanceof HttpException) {
    throw error;
  }

  if (error instanceof QueryFailedError) {
    const code = (error.driverError as { code?: string } | undefined)?.code;
    if (code === PG_UNIQUE_VIOLATION) {
      throw new ConflictException('Dữ liệu đã tồn tại');
    }
    if (code === PG_INVALID_TEXT_REPRESENTATION) {
      throw new BadRequestException('Dữ liệu không đúng định dạng');
    }
  }

  logger.error(`${context} thất bại`, error instanceof Error ? error.stack : String(error));
  throw new InternalServerErrorException('Lỗi hệ thống, vui lòng thử lại sau');
}

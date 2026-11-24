import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { ResponseMessage } from '../common/response.js';
import { ExecutePaymentDto } from './dto/execute-payment.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions.dto.js';
import { ListPaymentRequestsQueryDto } from './dto/list-payment-requests.dto.js';
import { PaymentsService } from './payments.service.js';
import { EmitsWorkflowChange } from '../notifications/workflow-change.js';
import { MAX_PROOF_SIZE, type UploadedProof } from './payment-proof.js';

const uuidPipe = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID yêu cầu chi không hợp lệ') });

/**
 * Thanh toán (màn 15, 16): xem cần quyền payment.menu, thực chi cần payment.execute.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Hồ sơ chờ chi + đã chi, có cột trạng thái; hồ sơ chờ chi lên đầu
  @Get('requests')
  @RequirePermissions('payment.menu')
  @ResponseMessage('Lấy danh sách hồ sơ thanh toán thành công')
  requests(@Query() query: ListPaymentRequestsQueryDto) {
    return this.paymentsService.listRequests(query);
  }

  @Get('stats')
  @RequirePermissions('payment.menu')
  @ResponseMessage('Lấy thống kê thanh toán thành công')
  stats() {
    return this.paymentsService.stats();
  }

  @Get('transactions')
  @RequirePermissions('payment.menu')
  @ResponseMessage('Lấy danh sách lệnh chi thành công')
  transactions(@Query() query: ListTransactionsQueryDto) {
    return this.paymentsService.listTransactions(query);
  }

  /** File ủy nhiệm chi của hồ sơ (xem trực tiếp trên trình duyệt) */
  @Get(':expenseId/proof')
  @RequirePermissions('payment.menu')
  async proof(@Param('expenseId', uuidPipe) expenseId: string) {
    const proof = await this.paymentsService.getProof(expenseId);
    return new StreamableFile(proof.data, {
      type: proof.mimeType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(proof.fileName)}`,
    });
  }

  /** multipart/form-data: file = ủy nhiệm chi (PDF/JPG/PNG ≤ 10 MB), note = ghi chú */
  @EmitsWorkflowChange('payment.execute')
  @Post(':expenseId')
  @RequirePermissions('payment.execute')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PROOF_SIZE + 1, files: 1 } }))
  @ResponseMessage('Đã hoàn thành chi')
  execute(
    @Param('expenseId', uuidPipe) expenseId: string,
    @UploadedFile() file: UploadedProof | undefined,
    @Body() dto: ExecutePaymentDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.paymentsService.execute(expenseId, file, dto, actor);
  }
}

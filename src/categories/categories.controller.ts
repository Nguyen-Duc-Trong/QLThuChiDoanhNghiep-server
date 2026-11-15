import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/confirm_token/jwt.strategy.js';
import { ResponseMessage } from '../common/response.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoriesDto } from './dto/create_categories.dto.js';
import { UpdateCategoriesDto } from './dto/update_categories.dto.js';
import { ListCategoriesQueryDto } from './dto/list_categories.dto.js';
import { DeleteCategoriesDto } from './dto/delete_categories.dto.js';

@Controller('categories')
@RequirePermissions('admin.categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ResponseMessage('Tạo danh mục thành công')
  create(@Body() dto: CreateCategoriesDto, @CurrentUser() actor: AuthUser) {
    return this.categoriesService.createCategories(dto, actor.userId);
  }

  @Patch('/:id')
  @ResponseMessage('Cập nhật danh mục thành công')
  update(
    @Body() dto: UpdateCategoriesDto,
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID danh mục không hợp lệ') })) id: string,
  ) {
    return this.categoriesService.updateCategories(id, dto, actor.userId);
  }

  // GET /categories?page=1&limit=10&search=&type=CHI&status=DANG_SU_DUNG
  @Get()
  @ResponseMessage('Lấy danh sách danh mục thành công')
  findAll(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Get('/:id')
  @ResponseMessage('Lấy thông tin danh mục thành công')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Delete()
  @ResponseMessage('Xóa danh mục thành công')
  delete(@Body() dto: DeleteCategoriesDto, @CurrentUser() actor: AuthUser) {
    return this.categoriesService.deleteCategories(dto.ids, actor.userId);
  }
}

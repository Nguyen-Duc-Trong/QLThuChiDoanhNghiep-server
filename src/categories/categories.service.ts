import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Categories } from './entity/categories.entity.js';
import { Users } from '../users/entity/users.entity.js';
import { BudgetLine } from '../budgets/entity/budget-line.entity.js';
import { ExpenseRequest } from '../expenses/entity/expense-request.entity.js';
import { PaginatedResult, paginate } from '../common/response.js';
import { CreateCategoriesDto } from './dto/create_categories.dto.js';
import {
  CATEGORY_STATUS_LABEL,
  CATEGORY_TYPE_LABEL,
  CategoryStatus,
} from '../common/types.js';
import { handleServiceError } from '../common/handle-error.js';
import { UpdateCategoriesDto } from './dto/update_categories.dto.js';
import { ListCategoriesQueryDto } from './dto/list_categories.dto.js';

/**
 * Một dòng trong danh sách danh mục. Giữ nguyên mã `type` / `status` (client dùng để lọc, đổi trạng thái)
 * và thêm nhãn tiếng Việt để hiển thị, kèm tên người cập nhật gần nhất.
 */
export type CategoryListItem = Categories & {
  typeLabel: string;
  statusLabel: string;
  updatedByName: string | null;
  // Số bản ghi đang tham chiếu (yêu cầu chi + dòng ngân sách). > 0 thì không xóa được, chỉ ngừng sử dụng.
  usage: number;
};

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Categories)
    private readonly categoriesRepository: Repository<Categories>,
  ) {}

  /**
   * Thêm danh mục mới. Mã và tên không được trùng trong cùng module (không phân biệt hoa thường).
   * actorId: người tạo (lưu vào createdBy / updatedBy).
   */
  /** id người dùng -> tên đăng nhập (một query cho cả trang) */
  private async findUserNames(
    ids: (string | null)[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const users = await this.categoriesRepository.manager
      .getRepository(Users)
      .find({
        where: { id: In(unique) },
        select: { id: true, username: true },
      });
    return new Map(users.map((u) => [u.id, u.username]));
  }

  /**
   * id danh mục -> số bản ghi đang dùng (yêu cầu chi + dòng ngân sách).
   * Khi có module Thu thì cộng thêm khoản thu ở đây.
   */
  private async countUsage(ids: string[]): Promise<Map<string, number>> {
    const usage = new Map<string, number>();
    if (ids.length === 0) return usage;
    const manager = this.categoriesRepository.manager;
    const count = (entity: typeof ExpenseRequest | typeof BudgetLine, alias: string) =>
      manager
        .createQueryBuilder(entity, alias)
        .select(`${alias}.categoryId`, 'categoryId')
        .addSelect('COUNT(*)::int', 'count')
        .where(`${alias}.categoryId IN (:...ids)`, { ids })
        .groupBy(`${alias}.categoryId`)
        .getRawMany<{ categoryId: string; count: number }>();
    const groups = await Promise.all([count(ExpenseRequest, 'e'), count(BudgetLine, 'b')]);
    for (const row of groups.flat()) {
      usage.set(row.categoryId, (usage.get(row.categoryId) ?? 0) + Number(row.count));
    }
    return usage;
  }

  async createCategories(
    dto: CreateCategoriesDto,
    actorId: string,
  ): Promise<Categories> {
    try {
      const duplicate = await this.categoriesRepository
        .createQueryBuilder('c')
        .where('c.type = :type', { type: dto.type })
        .andWhere(
          '(UPPER(c.code) = UPPER(:code) OR LOWER(c.name) = LOWER(:name))',
          { code: dto.code, name: dto.name },
        )
        .getOne();
      if (duplicate) {
        throw new ConflictException(
          duplicate.code.toUpperCase() === dto.code.toUpperCase()
            ? `Mã ${dto.code} đã tồn tại trong module ${dto.type}`
            : `Tên "${dto.name}" đã tồn tại trong module ${dto.type}`,
        );
      }

      const category = this.categoriesRepository.create({
        type: dto.type,
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
        status: dto.status ?? CategoryStatus.DANG_SU_DUNG,
        createdBy: actorId,
        updatedBy: actorId,
      });
      // Hai request tạo cùng lúc vẫn bị unique index (type, code) / (type, name) chặn → 409 qua handleServiceError
      return await this.categoriesRepository.save(category);
    } catch (error) {
      handleServiceError(error, this.logger, 'createCategories');
    }
  }

  /**
   * Cập nhật tên / mô tả / trạng thái (chỉ trường được gửi lên). Không đổi được module và mã.
   * - Không tìm thấy → 404.
   * - Tên mới trùng một danh mục khác cùng module (không phân biệt hoa thường) → 409.
   */
  async updateCategories(id: string, dto: UpdateCategoriesDto, actorId: string): Promise<Categories> {
    try {
      const category = await this.categoriesRepository.findOne({ where: { id } });
      if (!category) {
        throw new NotFoundException('Không tìm thấy danh mục');
      }

      if (dto.name !== undefined && dto.name.toLowerCase() !== category.name.toLowerCase()) {
        const duplicate = await this.categoriesRepository
          .createQueryBuilder('c')
          .where('c.type = :type', { type: category.type })
          .andWhere('c.id <> :id', { id })
          .andWhere('LOWER(c.name) = LOWER(:name)', { name: dto.name })
          .getExists();
        if (duplicate) {
          throw new ConflictException(`Tên "${dto.name}" đã tồn tại trong module ${category.type}`);
        }
      }

      // Chỉ gán trường thực sự được gửi (DTO khai báo field nên trường không gửi vẫn có mặt với giá trị undefined)
      if (dto.name !== undefined) category.name = dto.name;
      if (dto.description !== undefined) category.description = dto.description || null;
      if (dto.status !== undefined) category.status = dto.status;
      category.updatedBy = actorId;

      // Hai request đổi cùng lúc sang cùng một tên vẫn bị unique index (type, name) chặn → 409 qua handleServiceError
      return await this.categoriesRepository.save(category);
    } catch (error) {
      handleServiceError(error, this.logger, 'updateCategories');
    }
  }

  /**
   * Danh sách có phân trang. Lọc theo module (type), trạng thái; tìm theo mã / tên / mô tả (không phân biệt hoa thường).
   * Sắp xếp: cập nhật gần nhất lên đầu, cùng thời điểm thì theo mã.
   * Mỗi dòng kèm `updatedByName` (tên người cập nhật gần nhất) để hiển thị trên bảng.
   */
  async findAll(
    query: ListCategoriesQueryDto,
  ): Promise<PaginatedResult<CategoryListItem>> {
    try {
      const { page, limit, search, type, status } = query;
      const qb = this.categoriesRepository.createQueryBuilder('c');
      if (type) qb.andWhere('c.type = :type', { type });
      if (status) qb.andWhere('c.status = :status', { status });
      if (search) {
        // Thoát ký tự đặc biệt của LIKE để tìm đúng chuỗi người dùng gõ
        const keyword = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        qb.andWhere(
          '(c.code ILIKE :keyword OR c.name ILIKE :keyword OR c.description ILIKE :keyword)',
          { keyword },
        );
      }

      const [items, total] = await qb
        .orderBy('c.updatedAt', 'DESC')
        .addOrderBy('c.code', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const [names, usage] = await Promise.all([
        this.findUserNames(items.map((c) => c.updatedBy)),
        this.countUsage(items.map((c) => c.id)),
      ]);
      const rows: CategoryListItem[] = items.map((c) => ({
        ...c,
        typeLabel: CATEGORY_TYPE_LABEL[c.type] ?? c.type,
        statusLabel: CATEGORY_STATUS_LABEL[c.status] ?? c.status,
        updatedByName: c.updatedBy ? (names.get(c.updatedBy) ?? null) : null,
        usage: usage.get(c.id) ?? 0,
      }));
      return paginate(rows, total, page, limit);
    } catch (error) {
      handleServiceError(error, this.logger, 'findAll');
    }
  }

  async findOne(id: string): Promise<Categories | null> {
    try {
      return await this.categoriesRepository.findOne({ where: { id } });
    } catch (error) {
      handleServiceError(error, this.logger, 'findOne');
    }
  }

  async deleteCategories(ids: string[], actorId: string): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    try {
      const uniqueIds = [...new Set(ids)];
      const existing = await this.categoriesRepository.findBy({ id: In(uniqueIds) });
      const existingIds = existing.map((c) => c.id);
      const notFoundIds = uniqueIds.filter((id) => !existingIds.includes(id));

      // Danh mục đã có giao dịch / ngân sách tham chiếu thì không xóa (giữ lịch sử, báo cáo), chỉ ngừng sử dụng
      const usage = await this.countUsage(existingIds);
      const inUse = existing.filter((c) => (usage.get(c.id) ?? 0) > 0);
      if (inUse.length > 0) {
        throw new ConflictException(
          `Không thể xóa danh mục đang được sử dụng: ${inUse.map((c) => `${c.code} (${usage.get(c.id)} bản ghi)`).join(', ')}. Hãy chuyển sang "Ngừng sử dụng"`,
        );
      }

      if (existing.length > 0) {
        await this.categoriesRepository.delete(existingIds);
      }
      return { deletedIds: existingIds, notFoundIds };
    } catch (error) {
      handleServiceError(error, this.logger, 'deleteCategories');
    }
  }

}

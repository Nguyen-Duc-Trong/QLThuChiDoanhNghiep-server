import { IsNull, In } from 'typeorm';
import AppDataSource from '../data-source.js';
import {
  BudgetPeriodStatus,
  CategoryStatus,
  CategoryType,
  DepartmentKey,
  ProjectStatus,
  RoleKey,
} from '../../common/types.js';
import { Department } from '../../department/entity/department.entity.js';
import { Users } from '../../users/entity/users.entity.js';
import { Categories } from '../../categories/entity/categories.entity.js';
import { Project } from '../../budgets/entity/project.entity.js';
import { BudgetPeriod } from '../../budgets/entity/budget-period.entity.js';
import { BudgetLine } from '../../budgets/entity/budget-line.entity.js';

/**
 * Dữ liệu mẫu để chạy thử màn "Tạo yêu cầu chi": phòng ban, gán phòng cho người dùng, kỳ ngân sách,
 * dự án, dòng ngân sách. Chạy lại nhiều lần không tạo trùng (chỉ thêm phần còn thiếu).
 *
 *   npm run seed:budget
 */

// Phòng ban mẫu + vai trò được gán vào phòng (chỉ gán người chưa có phòng)
const DEPARTMENTS = [
  { code: DepartmentKey.DEV, name: 'Phòng Phát triển', roles: [RoleKey.NHAN_VIEN, RoleKey.TRUONG_PHONG] },
  { code: DepartmentKey.KE_TOAN, name: 'Phòng Kế toán', roles: [RoleKey.KE_TOAN] },
];

const PERIODS = [
  { code: 'Q4-2026', name: 'Quý IV/2026', startDate: '2026-10-01', endDate: '2026-12-31', totalLimit: 2_000_000_000, status: BudgetPeriodStatus.MO },
  { code: 'Q1-2027', name: 'Quý I/2027', startDate: '2027-01-01', endDate: '2027-03-31', totalLimit: 2_000_000_000, status: BudgetPeriodStatus.MO },
];

const PROJECTS = [
  { code: 'AV-2026-04', name: 'AV Brand', startDate: '2026-04-01', endDate: '2026-12-31' },
  { code: 'AV-2026-07', name: 'Ra mắt sản phẩm', startDate: '2026-07-01', endDate: '2027-06-30' },
];

// Hạn mức mỗi dòng (phòng × danh mục chi × kỳ)
const LINE_PLANNED_AMOUNT = 300_000_000;

async function seed() {
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (manager) => {
      // 1. Phòng ban + gán người dùng chưa có phòng
      for (const def of DEPARTMENTS) {
        let department = await manager.findOneBy(Department, { code: def.code });
        if (!department) {
          department = await manager.save(manager.create(Department, { code: def.code, name: def.name }));
          console.log(`+ Phòng ban ${def.name}`);
        }
        const result = await manager.update(
          Users,
          { role: In(def.roles), departmentId: IsNull() },
          { departmentId: department.id },
        );
        if (result.affected) console.log(`  gán ${result.affected} người dùng vào ${department.name}`);
      }

      // 2. Kỳ ngân sách
      for (const def of PERIODS) {
        if (!(await manager.existsBy(BudgetPeriod, { code: def.code }))) {
          await manager.save(manager.create(BudgetPeriod, { ...def, warningThreshold: 80 }));
          console.log(`+ Kỳ ngân sách ${def.name}`);
        }
      }

      // 3. Dự án
      const dev = await manager.findOneByOrFail(Department, { code: DepartmentKey.DEV });
      for (const def of PROJECTS) {
        if (!(await manager.existsBy(Project, { code: def.code }))) {
          await manager.save(manager.create(Project, { ...def, departmentId: dev.id, status: ProjectStatus.DANG_CHAY }));
          console.log(`+ Dự án ${def.code}`);
        }
      }

      // 4. Dòng ngân sách: mỗi phòng × mỗi danh mục chi đang dùng × mỗi kỳ
      const categories = await manager.findBy(Categories, { type: CategoryType.CHI, status: CategoryStatus.DANG_SU_DUNG });
      if (categories.length === 0) {
        console.warn('! Chưa có danh mục CHI đang sử dụng: tạo danh mục ở màn Danh mục rồi chạy lại seed');
      }
      const departments = await manager.findBy(Department, { code: In(DEPARTMENTS.map((d) => d.code)) });
      const periods = await manager.findBy(BudgetPeriod, { code: In(PERIODS.map((p) => p.code)) });
      for (const period of periods) {
        for (const department of departments) {
          for (const category of categories) {
            const where = { periodId: period.id, departmentId: department.id, categoryId: category.id, name: '' };
            if (!(await manager.existsBy(BudgetLine, where))) {
              await manager.save(manager.create(BudgetLine, { ...where, plannedAmount: LINE_PLANNED_AMOUNT }));
              console.log(`+ Dòng ngân sách ${period.code} · ${department.name} / ${category.name}`);
            }
          }
        }
      }
    });
    console.log('Seed ngân sách mẫu xong.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});

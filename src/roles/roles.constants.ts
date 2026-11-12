import { Permission as P, RoleKey } from '../common/types.js';
import type { Role } from './entity/role.entity.js';

/**
 * Ma trận quyền mặc định (giống ROLE_DEFINITIONS ở client/src/mocks/admin.js).
 * Chỉ dùng để tạo dữ liệu lần đầu; sau đó Admin sửa trực tiếp trong DB qua PUT /roles/:key/permissions.
 */
export const DEFAULT_ROLES: Pick<Role, 'key' | 'name' | 'scope' | 'permissions'>[] = [
  { key: RoleKey.NHAN_VIEN, name: 'Nhân viên', scope: 'Cá nhân', permissions: [P.VIEW, P.CREATE, P.SUBMIT] },
  {
    key: RoleKey.TRUONG_PHONG,
    name: 'Trưởng phòng',
    scope: 'Phòng ban',
    permissions: [P.VIEW, P.CREATE, P.EDIT, P.SUBMIT, P.DEPT_APPROVE],
  },
  {
    key: RoleKey.KE_TOAN,
    name: 'Kế toán',
    scope: 'Toàn công ty',
    permissions: [P.VIEW, P.CREATE, P.EDIT, P.ACC_APPROVE, P.PAY, P.CONFIRM_INCOME, P.BUDGET],
  },
  { key: RoleKey.LANH_DAO, name: 'Lãnh đạo', scope: 'Toàn công ty', permissions: [P.VIEW, P.FINAL_APPROVE, P.BUDGET] },
  {
    key: RoleKey.ADMIN,
    name: 'Admin',
    scope: 'Cấu hình hệ thống',
    permissions: [P.VIEW, P.CREATE, P.EDIT, P.USERS, P.CONFIG, P.AUDIT],
  },
];

/** Quyền ADMIN bắt buộc giữ, nếu bỏ thì không còn ai vào được màn quản trị */
export const ADMIN_REQUIRED_PERMISSIONS = [P.USERS, P.CONFIG];

export const ROLE_PERMISSIONS_CACHE_KEY = (key: RoleKey) => `role_permissions:${key}`;

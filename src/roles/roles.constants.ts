import { RoleKey } from '../common/types.js';
import { defaultPermissionsOf } from '../permissions/permission-catalog.js';
import type { Role } from './entity/role.entity.js';

/**
 * 5 vai trò hệ thống. Quyền mặc định lấy từ catalog (defaultRoles của từng quyền).
 * Chỉ dùng để tạo dữ liệu lần đầu; sau đó Admin sửa trực tiếp trong DB qua PUT /roles/:key/permissions.
 */
export const DEFAULT_ROLES: Pick<Role, 'key' | 'name' | 'scope' | 'permissions'>[] = [
  { key: RoleKey.NHAN_VIEN, name: 'Nhân viên', scope: 'Cá nhân' },
  { key: RoleKey.TRUONG_PHONG, name: 'Trưởng phòng', scope: 'Phòng ban' },
  { key: RoleKey.KE_TOAN, name: 'Kế toán', scope: 'Toàn công ty' },
  { key: RoleKey.LANH_DAO, name: 'Lãnh đạo', scope: 'Toàn công ty' },
  { key: RoleKey.ADMIN, name: 'Admin', scope: 'Cấu hình hệ thống' },
].map((role) => ({ ...role, permissions: defaultPermissionsOf(role.key) }));

export const ROLE_PERMISSIONS_CACHE_KEY = (key: RoleKey) => `role_permissions:${key}`;

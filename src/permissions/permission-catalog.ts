import { RoleKey } from '../common/types.js';

/**
 * DANH MỤC QUYỀN – nguồn sự thật duy nhất cho phân quyền.
 *
 * Mỗi module có quyền `<module>.menu` (hiện menu + vào trang) và các quyền thao tác `<module>.<action>`.
 * Quyền hiệu lực của một người = quyền của vai trò + cấp thêm riêng − thu hồi riêng (xem PermissionsService).
 *
 * THÊM QUYỀN MỚI:
 *  1. Thêm action vào module tương ứng bên dưới (key, label, defaultRoles, sensitive? adminRequired?).
 *  2. Thêm hằng tương ứng vào client/src/constants/permissions.js (PERMS).
 *  3. Dùng: @RequirePermissions('<key>') ở API; <Can permission=...> / handle.permissions ở client.
 *  4. Khởi động lại server: các vai trò trong defaultRoles tự được cấp (chỉ một lần, xem SeededPermission),
 *     màn "Vai trò & phân quyền" tự có cột mới (client đọc GET /permissions/catalog).
 *
 * sensitive     : quyền nhạy cảm (duyệt, thực chi, ngân sách...) – không bao giờ cấp cho ADMIN.
 * adminRequired : ADMIN bắt buộc giữ, nếu bỏ thì không ai vào được màn quản trị.
 */

const { NHAN_VIEN: NV, TRUONG_PHONG: TP, KE_TOAN: KT, LANH_DAO: LD, ADMIN: AD } = RoleKey;
const ALL = [NV, TP, KT, LD, AD];

export interface PermissionActionDef {
  key: string;
  label: string;
  description?: string;
  defaultRoles: readonly RoleKey[];
  sensitive?: boolean;
  adminRequired?: boolean;
}

export interface PermissionModuleDef {
  key: string;
  label: string;
  actions: readonly PermissionActionDef[];
}

export const PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    actions: [{ key: 'dashboard.menu', label: 'Xem menu', defaultRoles: ALL }],
  },
  {
    key: 'income',
    label: 'Quản lý thu',
    actions: [
      { key: 'income.menu', label: 'Xem menu', defaultRoles: ALL },
      { key: 'income.create', label: 'Tạo khoản thu', defaultRoles: [NV, TP, KT] },
      { key: 'income.edit', label: 'Sửa', defaultRoles: [TP, KT] },
      { key: 'income.delete', label: 'Xóa', defaultRoles: [KT] },
      { key: 'income.confirm', label: 'Xác nhận thực thu', defaultRoles: [KT], sensitive: true },
    ],
  },
  {
    key: 'expense',
    label: 'Yêu cầu chi',
    actions: [
      { key: 'expense.menu', label: 'Xem menu', defaultRoles: ALL },
      { key: 'expense.create', label: 'Tạo yêu cầu', defaultRoles: [NV, TP, KT] },
      { key: 'expense.edit', label: 'Sửa / bổ sung', defaultRoles: [NV, TP, KT] },
      { key: 'expense.delete', label: 'Xóa nháp', defaultRoles: [NV, TP, KT] },
      { key: 'expense.submit', label: 'Gửi duyệt', defaultRoles: [NV, TP] },
    ],
  },
  {
    key: 'approval',
    label: 'Phê duyệt',
    actions: [
      { key: 'approval.menu', label: 'Xem menu', defaultRoles: [TP, KT, LD] },
      { key: 'approval.dept', label: 'Duyệt phòng', defaultRoles: [TP], sensitive: true },
      { key: 'approval.accounting', label: 'Thẩm định kế toán', defaultRoles: [KT], sensitive: true },
      { key: 'approval.final', label: 'Duyệt cuối', defaultRoles: [LD], sensitive: true },
    ],
  },
  {
    key: 'payment',
    label: 'Thanh toán',
    actions: [
      { key: 'payment.menu', label: 'Xem menu', defaultRoles: [KT] },
      { key: 'payment.execute', label: 'Thực chi', defaultRoles: [KT], sensitive: true },
    ],
  },
  {
    key: 'budget',
    label: 'Ngân sách',
    actions: [
      { key: 'budget.menu', label: 'Xem menu', defaultRoles: ALL },
      { key: 'budget.allocate', label: 'Phân bổ ngân sách', defaultRoles: [KT, LD], sensitive: true },
    ],
  },
  {
    key: 'activity',
    label: 'Nhật ký & thông báo',
    actions: [
      { key: 'activity.menu', label: 'Xem menu', defaultRoles: ALL },
      { key: 'activity.audit', label: 'Xem nhật ký hệ thống', defaultRoles: [AD] },
    ],
  },
  {
    key: 'admin',
    label: 'Quản trị hệ thống',
    actions: [
      { key: 'admin.menu', label: 'Xem menu', defaultRoles: [AD], adminRequired: true },
      { key: 'admin.users', label: 'Người dùng', defaultRoles: [AD], adminRequired: true },
      { key: 'admin.roles', label: 'Vai trò & phân quyền', defaultRoles: [AD], adminRequired: true },
      { key: 'admin.departments', label: 'Phòng ban & cấu hình', defaultRoles: [AD] },
      { key: 'admin.categories', label: 'Danh mục', defaultRoles: [AD] },
    ],
  },
] as const satisfies readonly PermissionModuleDef[];

/** Kiểu quyền: hợp các key trong catalog, sai chính tả là TypeScript báo lỗi */
export type Permission = (typeof PERMISSION_MODULES)[number]['actions'][number]['key'];

const ACTIONS: readonly PermissionActionDef[] = (PERMISSION_MODULES as readonly PermissionModuleDef[]).flatMap(
  (m) => m.actions,
);

export const ALL_PERMISSIONS = ACTIONS.map((a) => a.key) as Permission[];

export const SENSITIVE_PERMISSIONS = ACTIONS.filter((a) => a.sensitive).map((a) => a.key) as Permission[];

export const ADMIN_REQUIRED_PERMISSIONS = ACTIONS.filter((a) => a.adminRequired).map((a) => a.key) as Permission[];

export const isPermission = (value: string): value is Permission => (ALL_PERMISSIONS as string[]).includes(value);

/** Quyền mặc định của một vai trò theo catalog */
export const defaultPermissionsOf = (role: RoleKey): Permission[] =>
  ACTIONS.filter((a) => a.defaultRoles.includes(role)).map((a) => a.key) as Permission[];

/** Vai trò mặc định được cấp một quyền */
export const defaultRolesOf = (permission: Permission): readonly RoleKey[] =>
  ACTIONS.find((a) => a.key === permission)?.defaultRoles ?? [];

/**
 * Key quyền kiểu cũ (trước khi tách theo module) → key mới. Dùng một lần khi khởi động để chuyển dữ liệu
 * trong bảng Roles. `view` không còn ý nghĩa riêng: vai trò chưa có quyền menu kiểu cũ nào sẽ nhận menu mặc định.
 */
export const LEGACY_PERMISSION_MAP: Record<string, Permission[]> = {
  create: ['income.create', 'expense.create'],
  edit: ['income.edit', 'expense.edit'],
  // Trước đây "Gửi" bao gồm cả bổ sung hồ sơ bị trả về, nay là quyền expense.edit
  submit: ['expense.submit', 'expense.edit'],
  deptApprove: ['approval.dept'],
  accApprove: ['approval.accounting'],
  finalApprove: ['approval.final'],
  pay: ['payment.execute'],
  confirmIncome: ['income.confirm'],
  budget: ['budget.allocate'],
  users: ['admin.users'],
  config: ['admin.roles', 'admin.departments', 'admin.categories'],
  audit: ['activity.audit'],
  menuOverview: ['dashboard.menu'],
  menuIncome: ['income.menu'],
  menuExpense: ['expense.menu'],
  menuApproval: ['approval.menu'],
  menuPayment: ['payment.menu'],
  menuBudget: ['budget.menu'],
  menuActivity: ['activity.menu'],
  menuAdmin: ['admin.menu'],
};

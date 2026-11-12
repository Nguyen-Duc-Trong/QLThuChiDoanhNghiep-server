export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted'
}

export type response<T> = {
    status: number;
    message: string;
    data: T;
}

/** Mã vai trò, khớp với client/src/constants/navigation.js (ROLES) */
export enum RoleKey {
    NHAN_VIEN = 'NHAN_VIEN',
    TRUONG_PHONG = 'TRUONG_PHONG',
    KE_TOAN = 'KE_TOAN',
    LANH_DAO = 'LANH_DAO',
    ADMIN = 'ADMIN',
}

/** Quyền thao tác, khớp với PERMISSION_ACTIONS ở client (cột của ma trận phân quyền) */
export enum Permission {
    VIEW = 'view',
    CREATE = 'create',
    EDIT = 'edit',
    SUBMIT = 'submit',
    DEPT_APPROVE = 'deptApprove',
    ACC_APPROVE = 'accApprove',
    FINAL_APPROVE = 'finalApprove',
    PAY = 'pay',
    CONFIRM_INCOME = 'confirmIncome',
    BUDGET = 'budget',
    USERS = 'users',
    CONFIG = 'config',
    AUDIT = 'audit',
}

/** Quyền nhạy cảm: không bao giờ được cấp cho ADMIN (Admin chỉ quản trị cấu hình) */
export const SENSITIVE_PERMISSIONS: readonly Permission[] = [
    Permission.DEPT_APPROVE,
    Permission.ACC_APPROVE,
    Permission.FINAL_APPROVE,
    Permission.PAY,
    Permission.CONFIRM_INCOME,
    Permission.BUDGET,
];

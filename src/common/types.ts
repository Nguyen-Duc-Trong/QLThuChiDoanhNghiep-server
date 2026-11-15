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

/** Quyền: sinh từ danh mục quyền (server/src/permissions/permission-catalog.ts) */
export type { Permission } from '../permissions/permission-catalog.js';

export enum DepartmentKey {
    KE_TOAN = 'KE_TOAN',
    TEST = 'TEST',
    BA = 'BA',
    DEV = 'DEV',
}

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

/** Danh mục áp dụng cho module Thu hay Chi */
export enum CategoryType {
    CHI = 'CHI',
    THU = 'THU',
}

/** Trạng thái danh mục: chỉ danh mục đang sử dụng mới được chọn khi tạo giao dịch */
export enum CategoryStatus {
    DANG_SU_DUNG = 'DANG_SU_DUNG',
    NGUNG_SU_DUNG = 'NGUNG_SU_DUNG',
}

/** Nhãn hiển thị tiếng Việt */
export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
    [CategoryType.THU]: 'Thu',
    [CategoryType.CHI]: 'Chi',
};

export const CATEGORY_STATUS_LABEL: Record<CategoryStatus, string> = {
    [CategoryStatus.DANG_SU_DUNG]: 'Đang sử dụng',
    [CategoryStatus.NGUNG_SU_DUNG]: 'Ngừng sử dụng',
};

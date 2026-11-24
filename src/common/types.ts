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

/** Trạng thái dự án: chỉ dự án đang chạy mới được chọn khi tạo yêu cầu chi */
export enum ProjectStatus {
    DANG_CHAY = 'DANG_CHAY',
    DA_DONG = 'DA_DONG',
}

/** Trạng thái kỳ ngân sách: chỉ kỳ đang mở mới được ghi nhận chi mới */
export enum BudgetPeriodStatus {
    NHAP = 'NHAP',
    MO = 'MO',
    DONG = 'DONG',
}

/** Trạng thái yêu cầu chi (luồng 5 bước) */
export enum ExpenseStatus {
    NHAP = 'NHAP',
    CHO_TRUONG_PHONG = 'CHO_TRUONG_PHONG',
    CHO_KE_TOAN = 'CHO_KE_TOAN',
    CHO_LANH_DAO = 'CHO_LANH_DAO',
    CAN_BO_SUNG = 'CAN_BO_SUNG',
    DA_DUYET = 'DA_DUYET',
    CHI_MOT_PHAN = 'CHI_MOT_PHAN',
    DA_THANH_TOAN = 'DA_THANH_TOAN',
    TU_CHOI = 'TU_CHOI',
    HUY = 'HUY',
}

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
    [ExpenseStatus.NHAP]: 'Nháp',
    [ExpenseStatus.CHO_TRUONG_PHONG]: 'Chờ trưởng phòng',
    [ExpenseStatus.CHO_KE_TOAN]: 'Chờ kế toán',
    [ExpenseStatus.CHO_LANH_DAO]: 'Chờ lãnh đạo',
    [ExpenseStatus.CAN_BO_SUNG]: 'Cần bổ sung',
    [ExpenseStatus.DA_DUYET]: 'Đã duyệt',
    [ExpenseStatus.CHI_MOT_PHAN]: 'Chi một phần',
    [ExpenseStatus.DA_THANH_TOAN]: 'Hoàn thành',
    [ExpenseStatus.TU_CHOI]: 'Từ chối',
    [ExpenseStatus.HUY]: 'Hủy',
};

/** Yêu cầu chi đã duyệt nhưng chưa chi hết: phần còn lại tính là "cam kết" của dòng ngân sách */
export const COMMITTED_EXPENSE_STATUSES = [ExpenseStatus.DA_DUYET, ExpenseStatus.CHI_MOT_PHAN];

export enum PaymentMethod {
    CHUYEN_KHOAN = 'CHUYEN_KHOAN',
    TIEN_MAT = 'TIEN_MAT',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
    [PaymentMethod.CHUYEN_KHOAN]: 'Chuyển khoản ngân hàng',
    [PaymentMethod.TIEN_MAT]: 'Tiền mặt',
};

/** Trạng thái đang chờ duyệt: hồ sơ khóa chỉnh sửa */
export const PENDING_EXPENSE_STATUSES = [
    ExpenseStatus.CHO_TRUONG_PHONG,
    ExpenseStatus.CHO_KE_TOAN,
    ExpenseStatus.CHO_LANH_DAO,
];

/** Bước duyệt của luồng chi 3 cấp */
export enum ApprovalStep {
    DEPT = 'DEPT',
    ACCOUNTING = 'ACCOUNTING',
    FINAL = 'FINAL',
}

export const APPROVAL_STEP_LABEL: Record<ApprovalStep, string> = {
    [ApprovalStep.DEPT]: 'Trưởng phòng phê duyệt',
    [ApprovalStep.ACCOUNTING]: 'Kế toán thẩm định',
    [ApprovalStep.FINAL]: 'Lãnh đạo duyệt cuối',
};

/** Quyết định tại một bước. BO_QUA: hệ thống bỏ qua bước (không có người duyệt hợp lệ, vd trưởng phòng tự tạo) */
export enum ApprovalDecision {
    DUYET = 'DUYET',
    BO_SUNG = 'BO_SUNG',
    TU_CHOI = 'TU_CHOI',
    BO_QUA = 'BO_QUA',
}

export const APPROVAL_DECISION_LABEL: Record<ApprovalDecision, string> = {
    [ApprovalDecision.DUYET]: 'Phê duyệt',
    [ApprovalDecision.BO_SUNG]: 'Yêu cầu bổ sung',
    [ApprovalDecision.TU_CHOI]: 'Từ chối',
    [ApprovalDecision.BO_QUA]: 'Bỏ qua bước',
};

/** Nguồn tiền chi (quỹ / tài khoản công ty). Khớp với client/src/constants/payments.js */
export const PAYMENT_SOURCES = ['Quỹ chính', 'Quỹ dự phòng'] as const;

/** Ngân hàng thực hiện lệnh chuyển khoản. Khớp với client/src/constants/payments.js */
export const PAYMENT_BANKS = ['Vietcombank', 'Techcombank', 'BIDV'] as const;

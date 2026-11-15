import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../common/types.js';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/**
 * Route yêu cầu người dùng có ĐỦ các quyền này (quyền hiệu lực: vai trò + ngoại lệ riêng).
 * Gắn được ở controller hoặc từng method; method ghi đè controller.
 *
 * Ví dụ: @RequirePermissions('payment.execute')
 */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Route chỉ cần có MỘT trong các quyền này. Dùng được cùng @RequirePermissions (phải thỏa cả hai).
 *
 * Ví dụ: @RequireAnyPermission('admin.users', 'admin.roles')
 */
export const RequireAnyPermission = (...permissions: Permission[]) => SetMetadata(ANY_PERMISSIONS_KEY, permissions);

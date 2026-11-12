import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../common/types.js';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Route yêu cầu người dùng có ĐỦ các quyền này (theo vai trò). Gắn được ở controller hoặc từng method;
 * method ghi đè controller.
 *
 * Ví dụ: @RequirePermissions(Permission.PAY)
 */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

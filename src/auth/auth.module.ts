import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { UsersModule } from "../users/users.module.js";
import { RolesModule } from "../roles/roles.module.js";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { CookieStrategy } from "./confirm_token/cookie.strategy.js";
import { JwtStrategy } from "./confirm_token/jwt.strategy.js";
import { JwtAuthGuard } from "./gaurds/jwt-auth.guard.js";
import { PermissionsGuard } from "./gaurds/permissions.guard.js";

@Module({
    // JwtModule cung cấp JwtService; secret/expiresIn truyền riêng khi sign
    // RedisService không khai báo ở đây: RedisModule là @Global nên đã có sẵn
    imports: [UsersModule, RolesModule, PermissionsModule, PassportModule, JwtModule.register({})],
    controllers: [AuthController],
    providers: [
        AuthService,
        CookieStrategy,
        JwtStrategy,
        // Guard global, chạy theo đúng thứ tự khai báo:
        // 1. JwtAuthGuard: đã đăng nhập chưa? (bỏ qua route @Public) -> 401
        // 2. PermissionsGuard: quyền hiệu lực (vai trò + quyền riêng) có đủ @RequirePermissions không? -> 403
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
    exports: [],
})
export class AuthModule {}

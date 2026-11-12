import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { RoleKey } from "../../common/types.js";

export class CreateUsersDto {
    @IsString()
    username: string

    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string

    @IsString()
    @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
    password: string

    // Bỏ trống thì mặc định là Nhân viên
    @IsOptional()
    @IsEnum(RoleKey, { message: 'Vai trò không hợp lệ' })
    role?: RoleKey
}

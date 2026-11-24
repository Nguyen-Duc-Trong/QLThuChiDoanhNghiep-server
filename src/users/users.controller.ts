import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ListUsersQueryDto } from "./dto/list-users.dto.js";
import { ResponseMessage } from "../common/response.js";
import { CreateUsersDto } from "./dto/create-users.dto.js";
import { UsersService } from "./users.service.js";
import { UpdateUsersDto } from "./dto/update-users.dto.js";
import { DeleteUsersDto } from "./dto/delete-users.dto.js";
import { RequirePermissions } from "../auth/decorators/permissions.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthUser } from "../auth/confirm_token/jwt.strategy.js";
import { EmitsWorkflowChange } from "../notifications/workflow-change.js";

// Cả controller: chỉ vai trò có quyền "Người dùng" (mặc định là ADMIN) mới gọi được
@Controller('users')
@RequirePermissions('admin.users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @EmitsWorkflowChange('user.create')
    @Post()
    @ResponseMessage('Tạo người dùng thành công')
    create(@Body() dto: CreateUsersDto) {
        return this.usersService.createUser(dto);
    }

    @EmitsWorkflowChange('user.update')
    @Put()
    @ResponseMessage('Cập nhật người dùng thành công')
    update(@Body() dto: UpdateUsersDto, @CurrentUser() actor: AuthUser) {
        return this.usersService.updateUser(dto, actor.userId);
    }

    @EmitsWorkflowChange('user.delete')
    @Delete()
    @ResponseMessage('Xóa người dùng thành công')
    delete(@Body() dto: DeleteUsersDto, @CurrentUser() actor: AuthUser) {
        return this.usersService.deleteUsers(dto.ids, actor.userId);
    }

    @Get()
    @ResponseMessage('Lấy danh sách người dùng thành công')
    findAll(@Query() query: ListUsersQueryDto) {
        return this.usersService.findAll(query);
    }

    @Get('/:id')
    @ResponseMessage('Lấy thông tin người dùng thành công')
    findOne(@Param('id') id: string) {
        return this.usersService.findById(id);
    }
}

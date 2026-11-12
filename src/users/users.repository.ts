import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Users } from "./entity/users.entity.js";
import { FindOptionsWhere, ILike, In, Repository } from "typeorm";
import { RoleKey, UserStatus } from "../common/types.js";

@Injectable()
export class UsersRepository {
    constructor(
        @InjectRepository(Users)
        private readonly usersRepository: Repository<Users>
    ) {}
    async findById(id: string): Promise<Users | null> {
        return await this.usersRepository.findOne({ where: { id } });
    }

    async createUser(user: Partial<Users>): Promise<Users | null> {
        const checkUser = await this.usersRepository.findOne({ where: { email: user.email } });
        if (checkUser) {
            return null
        }
        const newUser = this.usersRepository.create(user);
        return await this.usersRepository.save(newUser);
    }

    async updateUser(id: string, user: Partial<Users>): Promise<Users | null> {
        const checkUser = await this.usersRepository.findOne({ where: { id } });
        if (!checkUser) {
            return null
        }
        await this.usersRepository.update(id, user);
        return await this.usersRepository.findOne({ where: { id } });
    }

    // Danh sách có phân trang, tìm theo username/email, lọc theo trạng thái. Không trả mật khẩu.
    async findAll(params: { page: number; limit: number; search?: string; status?: UserStatus; role?: RoleKey }): Promise<[Users[], number]> {
        const { page, limit, search, status, role } = params;
        const base: FindOptionsWhere<Users> = { ...(status && { status }), ...(role && { role }) };
        const keyword = search?.trim();
        const where = keyword
            ? [{ ...base, username: ILike(`%${keyword}%`) }, { ...base, email: ILike(`%${keyword}%`) }]
            : base;
        return await this.usersRepository.findAndCount({
            where,
            select: { id: true, username: true, email: true, status: true, role: true },
            order: { username: 'ASC' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }

    // Email đã được người dùng khác (khác excludeId) sử dụng hay chưa
    async existsEmail(email: string, excludeId?: string): Promise<boolean> {
        const user = await this.usersRepository.findOne({ where: { email }, select: { id: true } });
        return Boolean(user && user.id !== excludeId);
    }

    // Lấy user theo email (kèm mật khẩu đã hash) — dùng cho đăng nhập
    async findByEmail(email: string): Promise<Users | null> {
        return await this.usersRepository.findOne({ where: { email } });
    }

    async findByIds(ids: string[]): Promise<Users[]> {
        return await this.usersRepository.find({ where: { id: In(ids) }, select: { id: true } });
    }

    async existsByRole(role: RoleKey): Promise<boolean> {
        return await this.usersRepository.exists({ where: { role } });
    }

    async deleteUsers(ids: string[]): Promise<number> {
        const result = await this.usersRepository.delete({ id: In(ids) });
        return result.affected ?? 0;
    }

}
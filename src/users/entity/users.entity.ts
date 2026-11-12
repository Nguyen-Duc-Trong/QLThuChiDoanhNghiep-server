import { Column, Entity } from "typeorm";
import { RoleKey, UserStatus } from "../../common/types.js";

@Entity('Users')
export class Users {
    @Column({ type: 'uuid', primary: true, generated: 'uuid' })
    id: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    username: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    password: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    email: string;

    @Column({ type: 'enum', enum: UserStatus, nullable: true })
    status: UserStatus;

    // Vai trò quyết định quyền (bảng Roles). User cũ chưa có vai trò sẽ mặc định là Nhân viên.
    @Column({ type: 'enum', enum: RoleKey, default: RoleKey.NHAN_VIEN })
    role: RoleKey;
}

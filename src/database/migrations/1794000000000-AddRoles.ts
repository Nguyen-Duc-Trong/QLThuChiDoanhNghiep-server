import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bảng Roles (ma trận phân quyền) + cột Users.role.
 *
 * Viết tay vì lúc generate, DB dev đã được synchronize tạo sẵn nên TypeORM không sinh ra.
 * Dùng IF NOT EXISTS để chạy được cả trên DB đã có bảng (dev) lẫn DB trống (Docker/triển khai).
 * Dữ liệu 5 vai trò mặc định do RolesService.onModuleInit tự tạo khi server khởi động.
 */
export class AddRoles1794000000000 implements MigrationInterface {
    name = 'AddRoles1794000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const roleValues = `'NHAN_VIEN', 'TRUONG_PHONG', 'KE_TOAN', 'LANH_DAO', 'ADMIN'`;

        await queryRunner.query(`DO $$ BEGIN
            CREATE TYPE "public"."Roles_key_enum" AS ENUM(${roleValues});
        EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "Roles" ("key" "public"."Roles_key_enum" NOT NULL, "name" character varying(100) NOT NULL, "scope" character varying(100) NOT NULL, "permissions" text array NOT NULL DEFAULT '{}', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3246f06721f32ce9e7fe45e52d3" PRIMARY KEY ("key"))`);

        await queryRunner.query(`DO $$ BEGIN
            CREATE TYPE "public"."Users_role_enum" AS ENUM(${roleValues});
        EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "role" "public"."Users_role_enum" NOT NULL DEFAULT 'NHAN_VIEN'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Users" DROP COLUMN IF EXISTS "role"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."Users_role_enum"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "Roles"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."Roles_key_enum"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phân quyền theo module + ngoại lệ từng người:
 * - SeededPermissions: quyền trong catalog đã được cấp mặc định cho vai trò (mỗi quyền một lần).
 * - UserPermissionOverrides: cấp thêm / thu hồi quyền riêng cho một người.
 *
 * Viết tay, dùng IF NOT EXISTS để chạy được cả trên DB dev đã được synchronize tạo bảng.
 * Việc đổi key quyền kiểu cũ trong bảng Roles do RolesService.onModuleInit làm khi server khởi động.
 */
export class AddModulePermissions1794600000000 implements MigrationInterface {
    name = 'AddModulePermissions1794600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "SeededPermissions" ("key" character varying(100) NOT NULL, "seededAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_SeededPermissions_key" PRIMARY KEY ("key"))`);

        await queryRunner.query(`DO $$ BEGIN
            CREATE TYPE "public"."UserPermissionOverrides_effect_enum" AS ENUM('grant', 'deny');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "UserPermissionOverrides" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "permission" character varying(100) NOT NULL, "effect" "public"."UserPermissionOverrides_effect_enum" NOT NULL, "reason" character varying(500), "updatedBy" uuid, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_UserPermissionOverrides_id" PRIMARY KEY ("id"), CONSTRAINT "FK_UserPermissionOverrides_userId" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_UserPermissionOverrides_user_permission" ON "UserPermissionOverrides" ("userId", "permission")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "UserPermissionOverrides"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."UserPermissionOverrides_effect_enum"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "SeededPermissions"`);
    }

}

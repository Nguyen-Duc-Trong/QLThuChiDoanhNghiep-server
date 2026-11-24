import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Màn 22 · Phòng ban & cấu hình:
 * - Departments.code: enum -> varchar(30) để admin tạo được phòng ban mới. Đổi kiểu tại chỗ (USING code::text)
 *   thay vì DROP/ADD cột như synchronize sẽ làm (mất mã phòng hiện có, và lỗi NOT NULL với dữ liệu cũ).
 * - Bảng ApprovalDelegations (ủy quyền phê duyệt) và SystemSettings (cấu hình key - value).
 */
export class DepartmentsDelegationsSettings1794900000000 implements MigrationInterface {
  name = 'DepartmentsDelegationsSettings1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Departments" ALTER COLUMN "code" TYPE character varying(30) USING "code"::text`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."Departments_code_enum"`);

    await queryRunner.query(
      `CREATE TABLE "ApprovalDelegations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fromUserId" uuid NOT NULL, "toUserId" uuid NOT NULL, "departmentId" uuid, "maxAmount" numeric(18,2), "startDate" date NOT NULL, "endDate" date NOT NULL, "note" text, "revokedAt" TIMESTAMP WITH TIME ZONE, "revokedBy" uuid, "createdBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_83500126a624950fb2c7570e728" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_808150e3d60bdd1eeb9e90140c" ON "ApprovalDelegations" ("fromUserId", "endDate")`,
    );
    await queryRunner.query(
      `CREATE TABLE "SystemSettings" ("key" character varying(50) NOT NULL, "value" jsonb NOT NULL, "updatedBy" uuid, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_81833f062664f37d8768fb43c51" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ApprovalDelegations" ADD CONSTRAINT "FK_60c4afbffcd5834f05e2117dac2" FOREIGN KEY ("fromUserId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ApprovalDelegations" ADD CONSTRAINT "FK_63005419c66bffcb8c54ad41af7" FOREIGN KEY ("toUserId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ApprovalDelegations" ADD CONSTRAINT "FK_60ac7bd422ff3de15adfd07a023" FOREIGN KEY ("departmentId") REFERENCES "Departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ApprovalDelegations"`);
    await queryRunner.query(`DROP TABLE "SystemSettings"`);
    // Chỉ quay lại enum được khi mọi mã phòng ban thuộc tập giá trị cũ
    await queryRunner.query(`CREATE TYPE "public"."Departments_code_enum" AS ENUM('KE_TOAN', 'TEST', 'BA', 'DEV')`);
    await queryRunner.query(
      `ALTER TABLE "Departments" ALTER COLUMN "code" TYPE "public"."Departments_code_enum" USING "code"::"public"."Departments_code_enum"`,
    );
  }
}

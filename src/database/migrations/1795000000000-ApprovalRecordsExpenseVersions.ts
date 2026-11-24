import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Luồng duyệt chi 3 cấp: ApprovalRecords (quyết định bất biến) và ExpenseRequestVersions (bản chụp mỗi lần gửi).
 * Dùng IF NOT EXISTS vì môi trường dev chạy synchronize có thể đã tự tạo bảng trước khi chạy migration.
 */
export class ApprovalRecordsExpenseVersions1795000000000 implements MigrationInterface {
  name = 'ApprovalRecordsExpenseVersions1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "public"."ApprovalRecords_step_enum" AS ENUM('DEPT', 'ACCOUNTING', 'FINAL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "public"."ApprovalRecords_decision_enum" AS ENUM('DUYET', 'BO_SUNG', 'TU_CHOI', 'BO_QUA');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "ApprovalRecords" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expenseId" uuid NOT NULL, "version" integer NOT NULL, "step" "public"."ApprovalRecords_step_enum" NOT NULL, "decision" "public"."ApprovalRecords_decision_enum" NOT NULL, "actorId" uuid, "onBehalfOfId" uuid, "note" text, "fields" text array NOT NULL DEFAULT '{}', "checklist" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_68cb225ec3245d5812b72b4f1fb" PRIMARY KEY ("id"), CONSTRAINT "FK_f771917a93f7e99a3307e6ac629" FOREIGN KEY ("expenseId") REFERENCES "ExpenseRequests"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7e4fdc3781c1b2040cb954132ef" FOREIGN KEY ("actorId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b8551c78b230ef27e3b403264c4" FOREIGN KEY ("onBehalfOfId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_5007d107c1d79cde2ec14ef527" ON "ApprovalRecords" ("expenseId", "createdAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "ExpenseRequestVersions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expenseId" uuid NOT NULL, "version" integer NOT NULL, "snapshot" jsonb NOT NULL, "submittedBy" uuid, "submittedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18f19b89f089549b5b995a37504" PRIMARY KEY ("id"), CONSTRAINT "FK_7ff7ce222181c19a4478c00562b" FOREIGN KEY ("expenseId") REFERENCES "ExpenseRequests"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_b30c59bae7dfd10375703b65bc" ON "ExpenseRequestVersions" ("expenseId", "version")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ExpenseRequestVersions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ApprovalRecords"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ApprovalRecords_decision_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ApprovalRecords_step_enum"`);
  }
}

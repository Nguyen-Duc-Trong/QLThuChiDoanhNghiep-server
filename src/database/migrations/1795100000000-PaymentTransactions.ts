import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lệnh chi của kế toán (bước 5 luồng chi). Mỗi yêu cầu chi chi đúng một lần (unique expenseId),
 * mã giao dịch ngân hàng không trùng (unique bankRef) để tránh chi kép.
 * Dùng IF NOT EXISTS vì môi trường dev chạy synchronize có thể đã tự tạo bảng trước khi chạy migration.
 */
export class PaymentTransactions1795100000000 implements MigrationInterface {
  name = 'PaymentTransactions1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "public"."PaymentTransactions_paymentmethod_enum" AS ENUM('CHUYEN_KHOAN', 'TIEN_MAT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "PaymentTransactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(30) NOT NULL,
        "expenseId" uuid NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "paymentMethod" "public"."PaymentTransactions_paymentmethod_enum" NOT NULL,
        "sourceAccount" character varying(100) NOT NULL,
        "bankName" character varying(100),
        "bankRef" character varying(50) NOT NULL,
        "executedAt" date NOT NULL,
        "executedById" uuid,
        "note" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_d2fdfdeaebe88e742cfbd6a7d03" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_803b89d20cde343fde3740eba3a" UNIQUE ("code"),
        CONSTRAINT "UQ_a9e076b7e01afc878093912a372" UNIQUE ("expenseId"),
        CONSTRAINT "UQ_c2c80a543edf44e3b982241fe7e" UNIQUE ("bankRef"),
        CONSTRAINT "FK_a9e076b7e01afc878093912a372" FOREIGN KEY ("expenseId") REFERENCES "ExpenseRequests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_e3941144f8077649054aa70544d" FOREIGN KEY ("executedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_e59e85f2beedb3179ba25001db" ON "PaymentTransactions" ("executedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "PaymentTransactions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."PaymentTransactions_paymentmethod_enum"`);
  }
}

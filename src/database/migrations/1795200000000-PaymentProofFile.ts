import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thực hiện chi đổi từ form (nguồn tiền, ngân hàng, mã giao dịch) sang tải lên file ủy nhiệm chi.
 * Các cột cũ cho phép null (chỉ còn ở lệnh chi cũ), thêm cột lưu thông tin file UNC.
 * Dùng IF NOT EXISTS vì môi trường dev chạy synchronize có thể đã tự thêm cột.
 */
export class PaymentProofFile1795200000000 implements MigrationInterface {
  name = 'PaymentProofFile1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ALTER COLUMN "sourceAccount" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ALTER COLUMN "bankRef" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ADD COLUMN IF NOT EXISTS "proofFileName" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ADD COLUMN IF NOT EXISTS "proofStoredName" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ADD COLUMN IF NOT EXISTS "proofMimeType" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ADD COLUMN IF NOT EXISTS "proofSize" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" DROP COLUMN IF EXISTS "proofSize"`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" DROP COLUMN IF EXISTS "proofMimeType"`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" DROP COLUMN IF EXISTS "proofStoredName"`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" DROP COLUMN IF EXISTS "proofFileName"`);
    // Lệnh chi bằng file UNC không có nguồn tiền / mã giao dịch nên không khôi phục được NOT NULL
  }
}

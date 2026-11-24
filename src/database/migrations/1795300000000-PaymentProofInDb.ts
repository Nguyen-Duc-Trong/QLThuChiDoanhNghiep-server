import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

// Thư mục file UNC cũ (trước khi chuyển vào DB), tính từ thư mục chạy lệnh như code cũ
const LEGACY_PROOF_DIR = join(process.cwd(), 'uploads', 'payment-proofs');

/**
 * File ủy nhiệm chi chuyển từ ổ đĩa (server/uploads/payment-proofs) vào cột bytea "proofData".
 * - Thêm cột proofData.
 * - Chép nội dung các file cũ vào DB (file không còn trên đĩa thì bỏ trống, API xem file trả 404).
 * - Bỏ cột proofStoredName (tên file trên đĩa) vì không còn dùng.
 * Dùng IF NOT EXISTS / IF EXISTS vì môi trường dev chạy synchronize có thể đã tự thêm / bỏ cột.
 */
export class PaymentProofInDb1795300000000 implements MigrationInterface {
  name = 'PaymentProofInDb1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ADD COLUMN IF NOT EXISTS "proofData" bytea`);

    const hasStoredName = await queryRunner.hasColumn('PaymentTransactions', 'proofStoredName');
    if (hasStoredName) {
      const rows: { id: string; proofStoredName: string }[] = await queryRunner.query(
        `SELECT "id", "proofStoredName" FROM "PaymentTransactions" WHERE "proofStoredName" IS NOT NULL AND "proofData" IS NULL`,
      );
      for (const row of rows) {
        const path = join(LEGACY_PROOF_DIR, row.proofStoredName);
        if (!existsSync(path)) continue;
        await queryRunner.query(`UPDATE "PaymentTransactions" SET "proofData" = $1 WHERE "id" = $2`, [readFileSync(path), row.id]);
      }
      await queryRunner.query(`ALTER TABLE "PaymentTransactions" DROP COLUMN "proofStoredName"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không ghi file ngược ra đĩa: chỉ khôi phục cấu trúc cột
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" ADD COLUMN IF NOT EXISTS "proofStoredName" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "PaymentTransactions" DROP COLUMN IF EXISTS "proofData"`);
  }
}

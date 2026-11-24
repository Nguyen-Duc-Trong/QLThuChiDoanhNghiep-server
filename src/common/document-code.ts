import type { EntityManager } from 'typeorm';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Sinh mã chứng từ <PREFIX>-YYYYMM-XXXX (vd CHI-202611-0001, GD-202611-0001), đánh số lại từ 1 mỗi tháng.
 * Tăng bộ đếm bằng một câu INSERT ... ON CONFLICT DO UPDATE ... RETURNING nên không trùng khi nhiều người tạo cùng lúc.
 */
export async function nextDocumentCode(manager: EntityManager, prefix: string): Promise<string> {
  const [year, month] = new Date().toLocaleDateString('sv-SE', { timeZone: TIME_ZONE }).split('-');
  const period = `${year}${month}`;
  const rows: { lastNumber: number }[] = await manager.query(
    `INSERT INTO "DocumentSequences" ("prefix", "period", "lastNumber") VALUES ($1, $2, 1)
     ON CONFLICT ("prefix", "period") DO UPDATE SET "lastNumber" = "DocumentSequences"."lastNumber" + 1
     RETURNING "lastNumber"`,
    [prefix, period],
  );
  return `${prefix}-${period}-${String(rows[0].lastNumber).padStart(4, '0')}`;
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (so sánh chuỗi được với cột date) */
export const todayVN = () => new Date().toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });

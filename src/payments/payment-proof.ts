import { extname } from 'node:path';

/** File ủy nhiệm chi lưu ngay trong DB (cột bytea PaymentTransactions.proofData), tối đa 10 MB */
export const MAX_PROOF_SIZE = 10 * 1024 * 1024;

const ALLOWED: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

/** Phần multer trả về khi dùng bộ nhớ (không phụ thuộc kiểu global Express.Multer) */
export interface UploadedProof {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Multer đọc tên file theo latin1 → đổi lại UTF-8 để giữ tên tiếng Việt */
export function decodeFileName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return (decoded.includes('\uFFFD') ? name : decoded).slice(0, 255);
}

/** Trả về đuôi file hợp lệ, hoặc null nếu loại file không được phép */
export function proofExtension(file: UploadedProof): string | null {
  const ext = extname(file.originalname).toLowerCase();
  const allowed = ALLOWED[file.mimetype];
  if (!allowed?.includes(ext)) return null;
  // Kiểm tra chữ ký đầu file để không nhận file đổi đuôi
  const head = file.buffer.subarray(0, 8);
  const ok =
    file.mimetype === 'application/pdf'
      ? head.subarray(0, 5).toString('latin1') === '%PDF-'
      : file.mimetype === 'image/png'
        ? head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  return ok ? ext : null;
}

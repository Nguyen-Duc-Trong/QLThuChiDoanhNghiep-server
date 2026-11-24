import type { ValueTransformer } from 'typeorm';

/**
 * Cột numeric của PostgreSQL được driver trả về dạng chuỗi. Đổi sang number để tính toán / trả JSON.
 * Tiền VND tối đa numeric(18,2) vẫn nằm trong khoảng số nguyên an toàn của JS với giá trị thực tế.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null || value === undefined ? null : Number(value)),
};

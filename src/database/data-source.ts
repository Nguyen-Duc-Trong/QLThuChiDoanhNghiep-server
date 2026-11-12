import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource, DataSourceOptions } from 'typeorm';

// Nạp biến môi trường khi chạy TypeORM CLI (không đi qua NestJS).
// Nạp cả server/.env và .env ở thư mục gốc; biến đã có thì không bị ghi đè,
// nên server/.env (nạp trước) được ưu tiên hơn.
for (const envPath of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')]) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

// Thư mục chứa file này: src/database (khi dev) hoặc dist/database (sau khi build)
const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// Chạy từ dist -> .js; chạy trực tiếp TS -> .ts (tránh match nhầm file .d.ts trong dist)
const ext = import.meta.url.endsWith('.ts') ? 'ts' : 'js';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'qlthuchi',
  entities: [`${rootDir}/**/*.entity.${ext}`],
  migrations: [`${rootDir}/database/migrations/*.${ext}`],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;

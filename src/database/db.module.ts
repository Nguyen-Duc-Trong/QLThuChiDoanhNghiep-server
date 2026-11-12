import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

const logger = new Logger('DbModule');
@Module({
    imports: [
        // forRootAsync: đợi ConfigModule nạp xong .env rồi mới đọc biến môi trường
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'postgres',
                host: config.get<string>('DB_HOST', 'localhost'),
                port: Number(config.get('DB_PORT', 5432)),
                username: config.get<string>('DB_USER', 'postgres'),
                password: config.get<string>('DB_PASSWORD', 'postgres'),
                database: config.get<string>('DB_NAME', 'qlthuchi'),
                autoLoadEntities: true,
                synchronize: true,
            }),
        })
    ]
})
export class DbModule {
    constructor(dataSource: DataSource) {
        if (dataSource.isInitialized) {
            logger.log('Database connected successfully');
        } else {
            logger.error('Database connection failed');
        }
    }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1794747331479 implements MigrationInterface {
    name = 'Migration1794747331479'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Categories_code_enum" AS ENUM('CHI', 'THU')`);
        await queryRunner.query(`CREATE TYPE "public"."Categories_type_enum" AS ENUM('CHI', 'THU')`);
        await queryRunner.query(`CREATE TYPE "public"."Categories_status_enum" AS ENUM('DANG_SU_DUNG', 'NGUNG_SU_DUNG')`);
        await queryRunner.query(`CREATE TABLE "Categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" "public"."Categories_code_enum" NOT NULL, "name" character varying(255) NOT NULL, "type" "public"."Categories_type_enum" NOT NULL, "description" text, "status" "public"."Categories_status_enum" NOT NULL, "createdBy" uuid, "updatedBy" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dac194a21e4878e29f2231ff56c" UNIQUE ("code"), CONSTRAINT "UQ_9004ab74b495518b3dee4f4222a" UNIQUE ("name"), CONSTRAINT "PK_537b5c00afe7427c4fc9434cd59" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "Categories"`);
        await queryRunner.query(`DROP TYPE "public"."Categories_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."Categories_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."Categories_code_enum"`);
    }

}

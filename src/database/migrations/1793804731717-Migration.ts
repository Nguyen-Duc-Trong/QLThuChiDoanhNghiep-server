import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1793804731717 implements MigrationInterface {
    name = 'Migration1793804731717'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Users_status_enum" AS ENUM('active', 'inactive', 'deleted')`);
        await queryRunner.query(`CREATE TABLE "Users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "status" "public"."Users_status_enum", CONSTRAINT "PK_16d4f7d636df336db11d87413e3" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "Users"`);
        await queryRunner.query(`DROP TYPE "public"."Users_status_enum"`);
    }

}

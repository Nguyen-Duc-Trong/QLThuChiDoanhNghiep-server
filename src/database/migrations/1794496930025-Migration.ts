import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1794496930025 implements MigrationInterface {
    name = 'Migration1794496930025'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Departments_code_enum" AS ENUM('KE_TOAN', 'TEST', 'BA', 'DEV')`);
        await queryRunner.query(`CREATE TABLE "Departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" "public"."Departments_code_enum" NOT NULL, "name" character varying(255) NOT NULL, "description" text, "headId" uuid, "approverId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6e485203999b6f24b6312f57ecb" UNIQUE ("code"), CONSTRAINT "UQ_0b0f21ff0ddda5676ab476a2e4b" UNIQUE ("name"), CONSTRAINT "PK_bc2db2043c7e4f09f6965b50186" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "Departments" ADD CONSTRAINT "FK_32502c58e632dac8faf7ade10d2" FOREIGN KEY ("headId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Departments" ADD CONSTRAINT "FK_52c57b65eb1adcd6d134488fbd9" FOREIGN KEY ("approverId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Departments" DROP CONSTRAINT "FK_52c57b65eb1adcd6d134488fbd9"`);
        await queryRunner.query(`ALTER TABLE "Departments" DROP CONSTRAINT "FK_32502c58e632dac8faf7ade10d2"`);
        await queryRunner.query(`DROP TABLE "Departments"`);
        await queryRunner.query(`DROP TYPE "public"."Departments_code_enum"`);
    }

}

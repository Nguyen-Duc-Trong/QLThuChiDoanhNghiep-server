import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller.js";
import { CategoriesService } from "./categories.service.js";
import { Categories } from "./entity/categories.entity.js";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
    imports: [TypeOrmModule.forFeature([Categories])],
    controllers: [CategoriesController],
    providers: [CategoriesService],
    exports: [CategoriesService],
})
export class CategoriesModule {}
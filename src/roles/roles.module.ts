import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entity/role.entity.js';
import { SeededPermission } from './entity/seeded-permission.entity.js';
import { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Role, SeededPermission])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}

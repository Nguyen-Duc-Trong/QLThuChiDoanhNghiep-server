import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { UserPermissionOverride } from './entity/user-permission-override.entity.js';
import { PermissionsService } from './permissions.service.js';
import { PermissionsController } from './permissions.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserPermissionOverride]), RolesModule, UsersModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}

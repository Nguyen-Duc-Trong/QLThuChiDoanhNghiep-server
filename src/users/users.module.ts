import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entity/users.entity.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

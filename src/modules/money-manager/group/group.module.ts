import { Module } from '@nestjs/common';
import { CreateGroupUseCase } from './application/use-cases/create-group.use-case';
import { UpdateGroupUseCase } from './application/use-cases/update-group.use-case';
import { DeleteGroupUseCase } from './application/use-cases/delete-group.use-case';
import { GetAllGroupsUseCase } from './application/use-cases/get-all-groups.use-case';
import { GROUP_REPOSITORY } from './domain/ports/group.repository.port';
import { GroupController } from './infrastructure/controllers/group.controller';
import { PrismaGroupRepository } from './infrastructure/repositories/prisma-group.repository';

@Module({
  controllers: [GroupController],
  providers: [
    {
      provide: GROUP_REPOSITORY,
      useClass: PrismaGroupRepository,
    },
    GetAllGroupsUseCase,
    CreateGroupUseCase,
    UpdateGroupUseCase,
    DeleteGroupUseCase,
  ],
})
export class GroupModule {}

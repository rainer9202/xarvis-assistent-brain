import { Module } from '@nestjs/common';
import { AccountModule } from '@modules/money-manager/account/account.module';
import { CategoryModule } from '@modules/money-manager/category/category.module';
import { GroupModule } from '@modules/money-manager/group/group.module';
import { CreateMovementUseCase } from './application/use-cases/create-movement.use-case';
import { UpdateMovementUseCase } from './application/use-cases/update-movement.use-case';
import { DeleteMovementUseCase } from './application/use-cases/delete-movement.use-case';
import { GetAllMovementsUseCase } from './application/use-cases/get-all-movements.use-case';
import { GetMovementByIdUseCase } from './application/use-cases/get-movement-by-id.use-case';
import { MOVEMENT_REPOSITORY } from './domain/ports/movement.repository.port';
import { MovementController } from './infrastructure/controllers/movement.controller';
import { PrismaMovementRepository } from './infrastructure/repositories/prisma-movement.repository';

@Module({
  imports: [AccountModule, CategoryModule, GroupModule],
  controllers: [MovementController],
  providers: [
    {
      provide: MOVEMENT_REPOSITORY,
      useClass: PrismaMovementRepository,
    },
    GetAllMovementsUseCase,
    GetMovementByIdUseCase,
    CreateMovementUseCase,
    UpdateMovementUseCase,
    DeleteMovementUseCase,
  ],
})
export class MovementModule {}

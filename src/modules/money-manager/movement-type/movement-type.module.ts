import { Module } from '@nestjs/common';
import { CreateMovementTypeUseCase } from './application/use-cases/create-movement-type.use-case';
import { DeleteMovementTypeUseCase } from './application/use-cases/delete-movement-type.use-case';
import { GetAllMovementTypesUseCase } from './application/use-cases/get-all-movement-types.use-case';
import { GetMovementTypeByIdUseCase } from './application/use-cases/get-movement-type-by-id.use-case';
import { MOVEMENT_TYPE_REPOSITORY } from './domain/ports/movement-type.repository.port';
import { MovementTypeController } from './infrastructure/controllers/movement-type.controller';
import { PrismaMovementTypeRepository } from './infrastructure/repositories/prisma-movement-type.repository';

@Module({
  controllers: [MovementTypeController],
  providers: [
    {
      provide: MOVEMENT_TYPE_REPOSITORY,
      useClass: PrismaMovementTypeRepository,
    },
    GetAllMovementTypesUseCase,
    CreateMovementTypeUseCase,
    DeleteMovementTypeUseCase,
    GetMovementTypeByIdUseCase,
  ],
  exports: [GetMovementTypeByIdUseCase],
})
export class MovementTypeModule {}

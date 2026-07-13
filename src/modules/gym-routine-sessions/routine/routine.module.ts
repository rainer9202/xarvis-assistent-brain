import { Module } from '@nestjs/common';
import { ExerciseModule } from '@modules/gym-routine-sessions/exercise/exercise.module';
import { CreateRoutineUseCase } from './application/use-cases/create-routine.use-case';
import { UpdateRoutineUseCase } from './application/use-cases/update-routine.use-case';
import { DeleteRoutineUseCase } from './application/use-cases/delete-routine.use-case';
import { GetAllRoutinesUseCase } from './application/use-cases/get-all-routines.use-case';
import { GetRoutineByIdUseCase } from './application/use-cases/get-routine-by-id.use-case';
import { ROUTINE_REPOSITORY } from './domain/ports/routine.repository.port';
import { RoutineController } from './infrastructure/controllers/routine.controller';
import { PrismaRoutineRepository } from './infrastructure/repositories/prisma-routine.repository';

@Module({
  imports: [ExerciseModule],
  controllers: [RoutineController],
  providers: [
    {
      provide: ROUTINE_REPOSITORY,
      useClass: PrismaRoutineRepository,
    },
    GetAllRoutinesUseCase,
    GetRoutineByIdUseCase,
    CreateRoutineUseCase,
    UpdateRoutineUseCase,
    DeleteRoutineUseCase,
  ],
  exports: [GetRoutineByIdUseCase, GetAllRoutinesUseCase],
})
export class RoutineModule {}

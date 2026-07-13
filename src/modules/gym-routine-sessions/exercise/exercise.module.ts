import { Module } from '@nestjs/common';
import { CreateExerciseUseCase } from './application/use-cases/create-exercise.use-case';
import { UpdateExerciseUseCase } from './application/use-cases/update-exercise.use-case';
import { DeleteExerciseUseCase } from './application/use-cases/delete-exercise.use-case';
import { GetAllExercisesUseCase } from './application/use-cases/get-all-exercises.use-case';
import { GetExerciseByIdUseCase } from './application/use-cases/get-exercise-by-id.use-case';
import { GetExercisesByIdsUseCase } from './application/use-cases/get-exercises-by-ids.use-case';
import { EXERCISE_REPOSITORY } from './domain/ports/exercise.repository.port';
import { ExerciseController } from './infrastructure/controllers/exercise.controller';
import { PrismaExerciseRepository } from './infrastructure/repositories/prisma-exercise.repository';

@Module({
  controllers: [ExerciseController],
  providers: [
    {
      provide: EXERCISE_REPOSITORY,
      useClass: PrismaExerciseRepository,
    },
    GetAllExercisesUseCase,
    GetExerciseByIdUseCase,
    GetExercisesByIdsUseCase,
    CreateExerciseUseCase,
    UpdateExerciseUseCase,
    DeleteExerciseUseCase,
  ],
  exports: [
    GetAllExercisesUseCase,
    GetExerciseByIdUseCase,
    GetExercisesByIdsUseCase,
  ],
})
export class ExerciseModule {}

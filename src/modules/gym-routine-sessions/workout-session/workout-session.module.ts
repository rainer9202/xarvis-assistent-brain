import { Module } from '@nestjs/common';
import { RoutineModule } from '@modules/gym-routine-sessions/routine/routine.module';
import { ExerciseModule } from '@modules/gym-routine-sessions/exercise/exercise.module';
import { CreateWorkoutSessionUseCase } from './application/use-cases/create-workout-session.use-case';
import { FinishWorkoutSessionUseCase } from './application/use-cases/finish-workout-session.use-case';
import { DeleteWorkoutSessionUseCase } from './application/use-cases/delete-workout-session.use-case';
import { GetAllWorkoutSessionsUseCase } from './application/use-cases/get-all-workout-sessions.use-case';
import { GetWorkoutSessionByIdUseCase } from './application/use-cases/get-workout-session-by-id.use-case';
import { CreateWorkoutSessionExerciseUseCase } from './application/use-cases/create-workout-session-exercise.use-case';
import { UpdateWorkoutSessionExerciseUseCase } from './application/use-cases/update-workout-session-exercise.use-case';
import { DeleteWorkoutSessionExerciseUseCase } from './application/use-cases/delete-workout-session-exercise.use-case';
import { GetExerciseProgressUseCase } from './application/use-cases/get-exercise-progress.use-case';
import { WORKOUT_SESSION_REPOSITORY } from './domain/ports/workout-session.repository.port';
import { WORKOUT_SESSION_EXERCISE_REPOSITORY } from './domain/ports/workout-session-exercise.repository.port';
import { WorkoutSessionController } from './infrastructure/controllers/workout-session.controller';
import { WorkoutSessionExerciseController } from './infrastructure/controllers/workout-session-exercise.controller';
import { ExerciseProgressController } from './infrastructure/controllers/exercise-progress.controller';
import { PrismaWorkoutSessionRepository } from './infrastructure/repositories/prisma-workout-session.repository';
import { PrismaWorkoutSessionExerciseRepository } from './infrastructure/repositories/prisma-workout-session-exercise.repository';

// Owns both WorkoutSession and WorkoutSessionExercise — they're tightly
// coupled (one feature folder) and don't need to be split into two separate
// .module.ts files, even though WorkoutSessionExercise has its own
// independent repository/use-cases/controller.
@Module({
  imports: [RoutineModule, ExerciseModule],
  controllers: [
    WorkoutSessionController,
    WorkoutSessionExerciseController,
    ExerciseProgressController,
  ],
  providers: [
    {
      provide: WORKOUT_SESSION_REPOSITORY,
      useClass: PrismaWorkoutSessionRepository,
    },
    {
      provide: WORKOUT_SESSION_EXERCISE_REPOSITORY,
      useClass: PrismaWorkoutSessionExerciseRepository,
    },
    GetAllWorkoutSessionsUseCase,
    GetWorkoutSessionByIdUseCase,
    CreateWorkoutSessionUseCase,
    FinishWorkoutSessionUseCase,
    DeleteWorkoutSessionUseCase,
    CreateWorkoutSessionExerciseUseCase,
    UpdateWorkoutSessionExerciseUseCase,
    DeleteWorkoutSessionExerciseUseCase,
    GetExerciseProgressUseCase,
  ],
})
export class WorkoutSessionModule {}

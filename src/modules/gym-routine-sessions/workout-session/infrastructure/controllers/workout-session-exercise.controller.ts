import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateWorkoutSessionExerciseCommand,
  CreateWorkoutSessionExerciseUseCase,
} from '../../application/use-cases/create-workout-session-exercise.use-case';
import {
  UpdateWorkoutSessionExerciseCommand,
  UpdateWorkoutSessionExerciseUseCase,
} from '../../application/use-cases/update-workout-session-exercise.use-case';
import {
  DeleteWorkoutSessionExerciseCommand,
  DeleteWorkoutSessionExerciseUseCase,
} from '../../application/use-cases/delete-workout-session-exercise.use-case';
import { CreateWorkoutSessionExerciseDto } from '../dto/create-workout-session-exercise.dto';
import { UpdateWorkoutSessionExerciseDto } from '../dto/update-workout-session-exercise.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'workout-session-exercises';

// No GET routes here — individual log entries are only ever viewed nested
// inside GET /workout-sessions/:id's response, never fetched standalone
// (same "not every resource needs every verb" reasoning as Category having
// no GET-by-id).
@ApiTags(domainName)
@Controller(domainName)
export class WorkoutSessionExerciseController {
  constructor(
    private readonly create: CreateWorkoutSessionExerciseUseCase,
    private readonly update: UpdateWorkoutSessionExerciseUseCase,
    private readonly remove: DeleteWorkoutSessionExerciseUseCase,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Workout session exercise logged' })
  @ApiNotFoundResponse({ description: 'Workout session or exercise not found' })
  async createOne(
    @Body() dto: CreateWorkoutSessionExerciseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateWorkoutSessionExerciseCommand(
          dto.workoutSessionId,
          user.id,
          dto.exerciseId,
          dto.actualSets,
          dto.actualReps,
          dto.actualWeightGrams,
        ),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Workout session exercise updated' })
  @ApiNotFoundResponse({ description: 'Workout session exercise not found' })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateWorkoutSessionExerciseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateWorkoutSessionExerciseCommand(
          id,
          user.id,
          dto.actualSets,
          dto.actualReps,
          dto.actualWeightGrams,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Workout session exercise not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(
        new DeleteWorkoutSessionExerciseCommand(id, user.id),
      ),
    };
  }
}

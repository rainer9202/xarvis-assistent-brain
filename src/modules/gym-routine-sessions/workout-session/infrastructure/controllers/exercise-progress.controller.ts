import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetExerciseProgressUseCase } from '../../application/use-cases/get-exercise-progress.use-case';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'workout-sessions';

// Route lives in the workout-session module (owns the logged data) rather
// than on ExerciseController — serving it from the exercise module would
// force ExerciseModule to import WorkoutSessionModule, inverting the
// existing exercise → (imported by) workout-session dependency and creating
// a real circular import (design.md ADR-1).
@ApiTags(domainName)
@Controller(domainName)
export class ExerciseProgressController {
  constructor(private readonly getProgress: GetExerciseProgressUseCase) {}

  @Get('exercises/:exerciseId/progress')
  @ApiOkResponse({ description: "Exercise's logged progress history" })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  async findProgress(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'Get exercise progress history successfully',
      data: await this.getProgress.execute(exerciseId, user.id),
    };
  }
}

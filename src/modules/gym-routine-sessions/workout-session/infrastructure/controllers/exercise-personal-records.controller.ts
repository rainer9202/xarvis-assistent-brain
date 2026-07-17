import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetPersonalRecordsUseCase } from '../../application/use-cases/get-personal-records.use-case';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'workout-sessions';

// Route lives in the workout-session module (owns the logged data) rather
// than on ExerciseController — same real circular-import constraint as the
// shipped ExerciseProgressController split (design.md ADR-1). No
// `:exerciseId` param here, so no visibility/404 gate is needed — ownership
// is enforced purely by scoping through WorkoutSession.userId.
@ApiTags(domainName)
@Controller(domainName)
export class ExercisePersonalRecordsController {
  constructor(private readonly getPersonalRecords: GetPersonalRecordsUseCase) {}

  @Get('exercises/records')
  @ApiOkResponse({
    description:
      "Every exercise's max-weight personal record for the authenticated user",
  })
  async findRecords(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'Get exercise personal records successfully',
      data: await this.getPersonalRecords.execute(user.id),
    };
  }
}

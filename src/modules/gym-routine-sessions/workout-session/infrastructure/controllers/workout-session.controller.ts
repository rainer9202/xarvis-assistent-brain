import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateWorkoutSessionCommand,
  CreateWorkoutSessionUseCase,
} from '../../application/use-cases/create-workout-session.use-case';
import {
  FinishWorkoutSessionCommand,
  FinishWorkoutSessionUseCase,
} from '../../application/use-cases/finish-workout-session.use-case';
import {
  DeleteWorkoutSessionCommand,
  DeleteWorkoutSessionUseCase,
} from '../../application/use-cases/delete-workout-session.use-case';
import { GetAllWorkoutSessionsUseCase } from '../../application/use-cases/get-all-workout-sessions.use-case';
import { GetWorkoutSessionByIdUseCase } from '../../application/use-cases/get-workout-session-by-id.use-case';
import { CreateWorkoutSessionDto } from '../dto/create-workout-session.dto';
import { GetWorkoutSessionsQueryDto } from '../dto/get-workout-sessions-query.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'workout-sessions';

@ApiTags(domainName)
@Controller(domainName)
export class WorkoutSessionController {
  constructor(
    private readonly getAll: GetAllWorkoutSessionsUseCase,
    private readonly getById: GetWorkoutSessionByIdUseCase,
    private readonly create: CreateWorkoutSessionUseCase,
    private readonly finish: FinishWorkoutSessionUseCase,
    private readonly remove: DeleteWorkoutSessionUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of workout sessions' })
  async findAll(
    @Query() query: GetWorkoutSessionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.getAll.execute(user.id, query.page, query.limit);
    return {
      message: `Get all ${domainName} successfully`,
      data: result.items,
      ...(result.pagination ?? {}),
    };
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Workout session found' })
  @ApiNotFoundResponse({ description: 'Workout session not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `Get ${domainName} successfully`,
      data: await this.getById.execute(id, user.id),
    };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Workout session created' })
  async createOne(
    @Body() dto: CreateWorkoutSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateWorkoutSessionCommand(
          user.id,
          dto.routineId,
          new Date(dto.date),
        ),
      ),
    };
  }

  @Patch(':id/finish')
  @ApiOkResponse({ description: 'Workout session finished' })
  @ApiNotFoundResponse({ description: 'Workout session not found' })
  async finishOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was finished successfully`,
      data: await this.finish.execute(
        new FinishWorkoutSessionCommand(id, user.id),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Workout session not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(
        new DeleteWorkoutSessionCommand(id, user.id),
      ),
    };
  }
}

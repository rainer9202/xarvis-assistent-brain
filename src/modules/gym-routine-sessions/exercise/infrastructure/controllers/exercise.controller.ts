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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateExerciseCommand,
  CreateExerciseUseCase,
} from '../../application/use-cases/create-exercise.use-case';
import {
  UpdateExerciseCommand,
  UpdateExerciseUseCase,
} from '../../application/use-cases/update-exercise.use-case';
import {
  DeleteExerciseCommand,
  DeleteExerciseUseCase,
} from '../../application/use-cases/delete-exercise.use-case';
import { GetAllExercisesUseCase } from '../../application/use-cases/get-all-exercises.use-case';
import { GetExerciseByIdUseCase } from '../../application/use-cases/get-exercise-by-id.use-case';
import { CreateExerciseDto } from '../dto/create-exercise.dto';
import { UpdateExerciseDto } from '../dto/update-exercise.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'exercises';

@ApiTags(domainName)
@Controller(domainName)
export class ExerciseController {
  constructor(
    private readonly getAll: GetAllExercisesUseCase,
    private readonly getById: GetExerciseByIdUseCase,
    private readonly create: CreateExerciseUseCase,
    private readonly update: UpdateExerciseUseCase,
    private readonly remove: DeleteExerciseUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of exercises (own + global catalog)' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(user.id),
    };
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Exercise found' })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
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
  @ApiCreatedResponse({ description: 'Exercise created' })
  async createOne(
    @Body() dto: CreateExerciseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateExerciseCommand(
          user.id,
          dto.name,
          dto.category,
          dto.bodyPart,
          dto.equipment,
          dto.target,
          dto.muscleGroup,
        ),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Exercise updated' })
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateExerciseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateExerciseCommand(
          id,
          user.id,
          dto.name,
          dto.category,
          dto.bodyPart,
          dto.equipment,
          dto.target,
          dto.muscleGroup,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Exercise not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteExerciseCommand(id, user.id)),
    };
  }
}

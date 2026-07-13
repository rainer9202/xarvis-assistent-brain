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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateRoutineCommand,
  CreateRoutineUseCase,
} from '../../application/use-cases/create-routine.use-case';
import {
  UpdateRoutineCommand,
  UpdateRoutineUseCase,
} from '../../application/use-cases/update-routine.use-case';
import {
  DeleteRoutineCommand,
  DeleteRoutineUseCase,
} from '../../application/use-cases/delete-routine.use-case';
import { GetAllRoutinesUseCase } from '../../application/use-cases/get-all-routines.use-case';
import { GetRoutineByIdUseCase } from '../../application/use-cases/get-routine-by-id.use-case';
import { CreateRoutineDto } from '../dto/create-routine.dto';
import { UpdateRoutineDto } from '../dto/update-routine.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'routines';

@ApiTags(domainName)
@Controller(domainName)
export class RoutineController {
  constructor(
    private readonly getAll: GetAllRoutinesUseCase,
    private readonly getById: GetRoutineByIdUseCase,
    private readonly create: CreateRoutineUseCase,
    private readonly update: UpdateRoutineUseCase,
    private readonly remove: DeleteRoutineUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of routines' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(user.id),
    };
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Routine found' })
  @ApiNotFoundResponse({ description: 'Routine not found' })
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
  @ApiCreatedResponse({ description: 'Routine created' })
  @ApiConflictResponse({ description: 'Name already exists' })
  async createOne(
    @Body() dto: CreateRoutineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateRoutineCommand(user.id, dto.name, dto.exercises),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Routine updated' })
  @ApiNotFoundResponse({ description: 'Routine not found' })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateRoutineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateRoutineCommand(
          id,
          user.id,
          dto.name,
          dto.isActive,
          dto.exercises,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Routine not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteRoutineCommand(id, user.id)),
    };
  }
}

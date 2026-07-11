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
  CreateMovementCommand,
  CreateMovementUseCase,
} from '../../application/use-cases/create-movement.use-case';
import {
  UpdateMovementCommand,
  UpdateMovementUseCase,
} from '../../application/use-cases/update-movement.use-case';
import {
  DeleteMovementCommand,
  DeleteMovementUseCase,
} from '../../application/use-cases/delete-movement.use-case';
import { GetAllMovementsUseCase } from '../../application/use-cases/get-all-movements.use-case';
import { GetMovementByIdUseCase } from '../../application/use-cases/get-movement-by-id.use-case';
import { CreateMovementDto } from '../dto/create-movement.dto';
import { UpdateMovementDto } from '../dto/update-movement.dto';
import { GetMovementsQueryDto } from '../dto/get-movements-query.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '@infra/decorators/current-user.decorator';

const domainName = 'movements';

@ApiTags(domainName)
@Controller(domainName)
export class MovementController {
  constructor(
    private readonly getAll: GetAllMovementsUseCase,
    private readonly getById: GetMovementByIdUseCase,
    private readonly create: CreateMovementUseCase,
    private readonly update: UpdateMovementUseCase,
    private readonly remove: DeleteMovementUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of movements' })
  async findAll(
    @Query() query: GetMovementsQueryDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(user.id, {
        accountId: query.accountId,
        categoryId: query.categoryId,
        movementType: query.movementType,
        month: query.month,
      }),
    };
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Movement found' })
  @ApiNotFoundResponse({ description: 'Movement not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The movement was found successfully`,
      data: await this.getById.execute(id, user.id),
    };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Movement created' })
  @ApiNotFoundResponse({
    description: 'Account or category not found',
  })
  async createOne(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateMovementCommand(
          dto.amountCents,
          new Date(dto.date),
          dto.note,
          dto.accountId,
          dto.categoryId,
          dto.movementType,
          user.id,
          dto.toAccountId,
        ),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Movement updated' })
  @ApiNotFoundResponse({
    description: 'Movement, account, or category not found',
  })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateMovementDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateMovementCommand(
          id,
          user.id,
          dto.amountCents,
          dto.date ? new Date(dto.date) : undefined,
          dto.note,
          dto.accountId,
          dto.categoryId,
          dto.movementType,
          dto.toAccountId,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Movement not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteMovementCommand(id, user.id)),
    };
  }
}

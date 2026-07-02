import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateMovementTypeCommand,
  CreateMovementTypeUseCase,
} from '../../application/use-cases/create-movement-type.use-case';
import {
  DeleteMovementTypeCommand,
  DeleteMovementTypeUseCase,
} from '../../application/use-cases/delete-movement-type.use-case';
import { GetAllMovementTypesUseCase } from '../../application/use-cases/get-all-movement-types.use-case';
import { CreateMovementTypeDto } from '../dto/create-movement-type.dto';

const domainName = 'movement-types';

@ApiTags(domainName)
@Controller(domainName)
export class MovementTypeController {
  constructor(
    private readonly getAll: GetAllMovementTypesUseCase,
    private readonly create: CreateMovementTypeUseCase,
    private readonly remove: DeleteMovementTypeUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of movement types' })
  async findAll() {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(),
    };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Movement type created' })
  @ApiConflictResponse({ description: 'Name already exists' })
  async createOne(@Body() dto: CreateMovementTypeDto) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(new CreateMovementTypeCommand(dto.name)),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Movement type not found' })
  async deleteOne(@Param('id') id: string) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteMovementTypeCommand(id)),
    };
  }
}

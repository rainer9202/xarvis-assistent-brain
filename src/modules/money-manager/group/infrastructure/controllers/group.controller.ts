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
  CreateGroupCommand,
  CreateGroupUseCase,
} from '../../application/use-cases/create-group.use-case';
import {
  UpdateGroupCommand,
  UpdateGroupUseCase,
} from '../../application/use-cases/update-group.use-case';
import {
  DeleteGroupCommand,
  DeleteGroupUseCase,
} from '../../application/use-cases/delete-group.use-case';
import { GetAllGroupsUseCase } from '../../application/use-cases/get-all-groups.use-case';
import { CreateGroupDto } from '../dto/create-group.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'groups';

@ApiTags(domainName)
@Controller(domainName)
export class GroupController {
  constructor(
    private readonly getAll: GetAllGroupsUseCase,
    private readonly create: CreateGroupUseCase,
    private readonly update: UpdateGroupUseCase,
    private readonly remove: DeleteGroupUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of groups' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(user.id),
    };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Group created' })
  @ApiConflictResponse({ description: 'Name already exists' })
  async createOne(
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateGroupCommand(dto.name, user.id, dto.budgetCents),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Group updated' })
  @ApiNotFoundResponse({ description: 'Group not found' })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateGroupCommand(
          id,
          user.id,
          dto.name,
          dto.isActive,
          dto.budgetCents,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Group not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteGroupCommand(id, user.id)),
    };
  }
}

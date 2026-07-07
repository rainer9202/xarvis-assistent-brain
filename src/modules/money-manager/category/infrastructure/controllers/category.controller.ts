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
  CreateCategoryCommand,
  CreateCategoryUseCase,
} from '../../application/use-cases/create-category.use-case';
import {
  UpdateCategoryCommand,
  UpdateCategoryUseCase,
} from '../../application/use-cases/update-category.use-case';
import {
  DeleteCategoryCommand,
  DeleteCategoryUseCase,
} from '../../application/use-cases/delete-category.use-case';
import { GetAllCategoriesUseCase } from '../../application/use-cases/get-all-categories.use-case';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '@shared/guards/auth.guard';

const domainName = 'categories';

@ApiTags(domainName)
@Controller(domainName)
export class CategoryController {
  constructor(
    private readonly getAll: GetAllCategoriesUseCase,
    private readonly create: CreateCategoryUseCase,
    private readonly update: UpdateCategoryUseCase,
    private readonly remove: DeleteCategoryUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of categories' })
  async findAll(@CurrentUser() user: AuthenticatedRequest['user']) {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(user.id),
    };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Category created' })
  @ApiNotFoundResponse({ description: 'Movement type not found' })
  @ApiConflictResponse({
    description: 'Name already exists for this movement type',
  })
  async createOne(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateCategoryCommand(dto.name, dto.movementTypeId, user.id),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Category updated' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateCategoryCommand(
          id,
          user.id,
          dto.name,
          dto.movementTypeId,
          dto.isActive,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Category not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteCategoryCommand(id, user.id)),
    };
  }
}

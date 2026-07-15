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
  CreateBodyMetricCommand,
  CreateBodyMetricUseCase,
} from '../../application/use-cases/create-body-metric.use-case';
import {
  UpdateBodyMetricCommand,
  UpdateBodyMetricUseCase,
} from '../../application/use-cases/update-body-metric.use-case';
import {
  DeleteBodyMetricCommand,
  DeleteBodyMetricUseCase,
} from '../../application/use-cases/delete-body-metric.use-case';
import { GetAllBodyMetricsUseCase } from '../../application/use-cases/get-all-body-metrics.use-case';
import { GetBodyMetricByIdUseCase } from '../../application/use-cases/get-body-metric-by-id.use-case';
import { CreateBodyMetricDto } from '../dto/create-body-metric.dto';
import { UpdateBodyMetricDto } from '../dto/update-body-metric.dto';
import { GetBodyMetricsQueryDto } from '../dto/get-body-metrics-query.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@infra/decorators/current-user.decorator';

const domainName = 'body-metrics';

@ApiTags(domainName)
@Controller(domainName)
export class BodyMetricController {
  constructor(
    private readonly getAll: GetAllBodyMetricsUseCase,
    private readonly getById: GetBodyMetricByIdUseCase,
    private readonly create: CreateBodyMetricUseCase,
    private readonly update: UpdateBodyMetricUseCase,
    private readonly remove: DeleteBodyMetricUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of body metrics' })
  async findAll(
    @Query() query: GetBodyMetricsQueryDto,
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
  @ApiOkResponse({ description: 'Body metric found' })
  @ApiNotFoundResponse({ description: 'Body metric not found' })
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
  @ApiCreatedResponse({ description: 'Body metric created' })
  async createOne(
    @Body() dto: CreateBodyMetricDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateBodyMetricCommand(
          user.id,
          dto.weightGrams,
          dto.heightCm,
          dto.measuredAt ? new Date(dto.measuredAt) : undefined,
        ),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Body metric updated' })
  @ApiNotFoundResponse({ description: 'Body metric not found' })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateBodyMetricDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateBodyMetricCommand(
          id,
          user.id,
          dto.weightGrams,
          dto.heightCm,
          dto.measuredAt ? new Date(dto.measuredAt) : undefined,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Body metric not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteBodyMetricCommand(id, user.id)),
    };
  }
}

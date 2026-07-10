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
  CreateAccountCommand,
  CreateAccountUseCase,
} from '../../application/use-cases/create-account.use-case';
import {
  UpdateAccountCommand,
  UpdateAccountUseCase,
} from '../../application/use-cases/update-account.use-case';
import {
  DeleteAccountCommand,
  DeleteAccountUseCase,
} from '../../application/use-cases/delete-account.use-case';
import { GetAllAccountsUseCase } from '../../application/use-cases/get-all-accounts.use-case';
import { GetAccountByIdUseCase } from '../../application/use-cases/get-account-by-id.use-case';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '@infra/decorators/current-user.decorator';

const domainName = 'accounts';

@ApiTags(domainName)
@Controller(domainName)
export class AccountController {
  constructor(
    private readonly getAll: GetAllAccountsUseCase,
    private readonly getById: GetAccountByIdUseCase,
    private readonly create: CreateAccountUseCase,
    private readonly update: UpdateAccountUseCase,
    private readonly remove: DeleteAccountUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of accounts with computed balance' })
  async findAll(@CurrentUser() user: AuthenticatedRequest['user']) {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(user.id),
    };
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Account with computed balance' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The account was found successfully`,
      data: await this.getById.execute(id, user.id),
    };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Account created' })
  async createOne(
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateAccountCommand(dto.name, dto.type, user.id),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Account updated' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  async updateOne(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateAccountCommand(
          id,
          user.id,
          dto.name,
          dto.type,
          dto.isActive,
          dto.isPrincipal,
        ),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Account not found' })
  async deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteAccountCommand(id, user.id)),
    };
  }
}

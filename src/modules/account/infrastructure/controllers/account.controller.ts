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
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';

const domainName = 'accounts';

@ApiTags(domainName)
@Controller(domainName)
export class AccountController {
  constructor(
    private readonly getAll: GetAllAccountsUseCase,
    private readonly create: CreateAccountUseCase,
    private readonly update: UpdateAccountUseCase,
    private readonly remove: DeleteAccountUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'List of accounts with computed balance' })
  async findAll() {
    return {
      message: `Get all ${domainName} successfully`,
      data: await this.getAll.execute(),
    };
  }

  @Post()
  @ApiCreatedResponse({ description: 'Account created' })
  async createOne(@Body() dto: CreateAccountDto) {
    return {
      message: `The ${domainName} was created successfully`,
      data: await this.create.execute(
        new CreateAccountCommand(dto.name, dto.type),
      ),
    };
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Account updated' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  async updateOne(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return {
      message: `The ${domainName} was updated successfully`,
      data: await this.update.execute(
        new UpdateAccountCommand(id, dto.name, dto.type, dto.isActive),
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Account not found' })
  async deleteOne(@Param('id') id: string) {
    return {
      message: `The ${domainName} was deleted successfully`,
      data: await this.remove.execute(new DeleteAccountCommand(id)),
    };
  }
}

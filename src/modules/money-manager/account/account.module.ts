import { Module } from '@nestjs/common';
import { CreateAccountUseCase } from './application/use-cases/create-account.use-case';
import { UpdateAccountUseCase } from './application/use-cases/update-account.use-case';
import { DeleteAccountUseCase } from './application/use-cases/delete-account.use-case';
import { GetAllAccountsUseCase } from './application/use-cases/get-all-accounts.use-case';
import { GetAccountByIdUseCase } from './application/use-cases/get-account-by-id.use-case';
import { ProvisionDefaultAccountsUseCase } from './application/use-cases/provision-default-accounts.use-case';
import { ACCOUNT_REPOSITORY } from './domain/ports/account.repository.port';
import { AccountController } from './infrastructure/controllers/account.controller';
import { PrismaAccountRepository } from './infrastructure/repositories/prisma-account.repository';

@Module({
  controllers: [AccountController],
  providers: [
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: PrismaAccountRepository,
    },
    GetAllAccountsUseCase,
    CreateAccountUseCase,
    UpdateAccountUseCase,
    DeleteAccountUseCase,
    GetAccountByIdUseCase,
    ProvisionDefaultAccountsUseCase,
  ],
  exports: [
    GetAccountByIdUseCase,
    GetAllAccountsUseCase,
    ProvisionDefaultAccountsUseCase,
  ],
})
export class AccountModule {}

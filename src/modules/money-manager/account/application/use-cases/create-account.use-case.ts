import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import {
  ACCOUNT_TYPE_CODES,
  type AccountTypeCode,
} from '../../domain/enums/account-type.enum';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

// Local, duplicated per file — mirrors the TRANSFER_TYPE_NAME pattern
// duplicated across PrismaAccountRepository / create-movement.use-case.ts /
// update-movement.use-case.ts, rather than a shared cross-module enum file.
const CREDIT_TYPE_NAME = 'AT03';

export type CreateAccountResponse = {
  id: string;
};

export class CreateAccountCommand {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly userId: string,
    public readonly creditLimitCents?: number,
  ) {}
}

@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(command: CreateAccountCommand): Promise<CreateAccountResponse> {
    try {
      if (!ACCOUNT_TYPE_CODES.includes(command.type as AccountTypeCode))
        throw new ValidationException(
          `Account type "${command.type}" is invalid. Must be one of: ${ACCOUNT_TYPE_CODES.join(', ')}`,
        );

      if (command.type === CREDIT_TYPE_NAME) {
        if (command.creditLimitCents == null || command.creditLimitCents < 1)
          throw new ValidationException(
            'creditLimitCents is required for Crédito accounts',
          );
      } else if (command.creditLimitCents !== undefined) {
        throw new ValidationException(
          'creditLimitCents is only allowed for Crédito accounts',
        );
      }

      const accountCount = await this.repository.countByUserId(command.userId);

      const entity = new AccountEntity({
        name: command.name,
        type: command.type,
        userId: command.userId,
        isActive: true,
        isPrincipal: accountCount === 0,
        creditLimitCents: command.creditLimitCents,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating account: ${error}`);
    }
  }
}

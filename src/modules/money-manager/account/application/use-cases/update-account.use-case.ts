import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
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

export type UpdateAccountResponse = {
  id: string;
};

export class UpdateAccountCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly type?: string,
    public readonly isActive?: boolean,
    public readonly isPrincipal?: boolean,
    public readonly creditLimitCents?: number | null,
  ) {}
}

@Injectable()
export class UpdateAccountUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(command: UpdateAccountCommand): Promise<UpdateAccountResponse> {
    try {
      const account = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!account)
        throw new NotFoundException(`Account "${command.id}" not found`);

      if (command.isPrincipal === false)
        throw new ValidationException(
          'Cannot unset the principal account directly — mark a different account as principal instead',
        );

      if (command.name !== undefined) account.name = command.name;
      if (command.type !== undefined) {
        if (!ACCOUNT_TYPE_CODES.includes(command.type as AccountTypeCode))
          throw new ValidationException(
            `Account type "${command.type}" is invalid. Must be one of: ${ACCOUNT_TYPE_CODES.join(', ')}`,
          );
        account.type = command.type;
      }
      if (command.isActive !== undefined) account.isActive = command.isActive;

      const touchesCreditFields =
        command.type !== undefined || command.creditLimitCents !== undefined;

      if (touchesCreditFields) {
        // account.type was already updated above when command.type was
        // provided, so it already reflects the effective type here.
        const effectiveCreditLimitCents =
          command.creditLimitCents !== undefined
            ? command.creditLimitCents
            : account.creditLimitCents;

        if (account.type === CREDIT_TYPE_NAME) {
          if (
            effectiveCreditLimitCents == null ||
            effectiveCreditLimitCents < 1
          )
            throw new ValidationException(
              'creditLimitCents is required for Crédito accounts',
            );
        } else if (effectiveCreditLimitCents != null) {
          throw new ValidationException(
            'creditLimitCents is only allowed for Crédito accounts',
          );
        }
      }

      if (command.creditLimitCents !== undefined)
        account.creditLimitCents = command.creditLimitCents;

      const saved = await this.repository.update(account);

      if (command.isPrincipal === true)
        await this.repository.setPrincipal(command.id, command.userId);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating account: ${error}`);
    }
  }
}

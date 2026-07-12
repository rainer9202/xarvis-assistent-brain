import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { getAccountTypeLabel } from '../../domain/enums/account-type.enum';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export type GetAccountByIdResponse = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  isActive: boolean;
  isPrincipal: boolean;
  creditLimitCents: number | null;
  balanceCents: number;
  createdAt: Date;
};

@Injectable()
export class GetAccountByIdUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(id: string, userId: string): Promise<GetAccountByIdResponse> {
    try {
      const result = await this.repository.findByIdWithBalance(id, userId);
      if (!result) throw new NotFoundException(`Account "${id}" not found`);

      return {
        id: result.account.id!,
        name: result.account.name,
        type: result.account.type,
        typeLabel:
          getAccountTypeLabel(result.account.type) ?? result.account.type,
        isActive: result.account.isActive!,
        isPrincipal: result.account.isPrincipal!,
        creditLimitCents: result.account.creditLimitCents ?? null,
        balanceCents: result.balanceCents,
        createdAt: result.account.createdAt!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching account: ${error}`);
    }
  }
}

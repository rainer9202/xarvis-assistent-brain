import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { ACCOUNT_REPOSITORY } from '../../domain/ports/account.repository.port';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';

export type GetAllAccountsResponse = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isPrincipal: boolean;
  balanceCents: number;
  createdAt: Date;
};

@Injectable()
export class GetAllAccountsUseCase {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly repository: AccountRepositoryPort,
  ) {}

  async execute(userId: string): Promise<GetAllAccountsResponse[]> {
    try {
      const items = await this.repository.findAllWithBalance(userId);
      return items.map(({ account, balanceCents }) => ({
        id: account.id!,
        name: account.name,
        type: account.type,
        isActive: account.isActive!,
        isPrincipal: account.isPrincipal!,
        balanceCents,
        createdAt: account.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching accounts: ${error}`);
    }
  }
}

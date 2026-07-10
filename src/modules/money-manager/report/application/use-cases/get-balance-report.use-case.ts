import { Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { GetAllAccountsUseCase } from '@modules/money-manager/account/application/use-cases/get-all-accounts.use-case';

export type GetBalanceReportResponse = {
  accounts: { id: string; name: string; balanceCents: number }[];
  totalBalanceCents: number;
};

@Injectable()
export class GetBalanceReportUseCase {
  constructor(private readonly getAllAccounts: GetAllAccountsUseCase) {}

  async execute(userId: string): Promise<GetBalanceReportResponse> {
    try {
      const accounts = await this.getAllAccounts.execute(userId);

      return {
        accounts: accounts.map(({ id, name, balanceCents }) => ({
          id,
          name,
          balanceCents,
        })),
        totalBalanceCents: accounts.reduce(
          (total, account) => total + account.balanceCents,
          0,
        ),
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error building balance report: ${error}`);
    }
  }
}

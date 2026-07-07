import type { GetAllAccountsUseCase } from '@modules/money-manager/account/application/use-cases/get-all-accounts.use-case';
import { GetBalanceReportUseCase } from './get-balance-report.use-case';

describe('GetBalanceReportUseCase', () => {
  let getAllAccountsExecute: jest.Mock;
  let getAllAccounts: GetAllAccountsUseCase;
  let useCase: GetBalanceReportUseCase;

  beforeEach(() => {
    getAllAccountsExecute = jest.fn();
    getAllAccounts = {
      execute: getAllAccountsExecute,
    } as unknown as GetAllAccountsUseCase;
    useCase = new GetBalanceReportUseCase(getAllAccounts);
  });

  it('sums balanceCents across every account into a single total', async () => {
    getAllAccountsExecute.mockResolvedValue([
      { id: 'acc-1', name: 'Checking', balanceCents: -3500 },
      { id: 'acc-2', name: 'Savings', balanceCents: 1000 },
    ]);

    const result = await useCase.execute();

    expect(result).toEqual({
      accounts: [
        { id: 'acc-1', name: 'Checking', balanceCents: -3500 },
        { id: 'acc-2', name: 'Savings', balanceCents: 1000 },
      ],
      totalBalanceCents: -2500,
    });
  });

  it('returns a zero total when there are no accounts', async () => {
    getAllAccountsExecute.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual({ accounts: [], totalBalanceCents: 0 });
  });
});

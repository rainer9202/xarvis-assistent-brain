import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { ProvisionDefaultAccountsUseCase } from '@modules/money-manager/account/application/use-cases/provision-default-accounts.use-case';
import { ProvisionDefaultCategoriesUseCase } from '@modules/money-manager/category/application/use-cases/provision-default-categories.use-case';
import { ProvisionDefaultGroupsUseCase } from '@modules/money-manager/group/application/use-cases/provision-default-groups.use-case';
import { DefaultUserDataProvisioner } from './default-user-data-provisioner';

describe('DefaultUserDataProvisioner', () => {
  let executeAccounts: jest.Mock<Promise<void>, [string, TransactionContext?]>;
  let executeCategories: jest.Mock<
    Promise<void>,
    [string, TransactionContext?]
  >;
  let executeGroups: jest.Mock<Promise<void>, [string, TransactionContext?]>;
  let provisionAccounts: ProvisionDefaultAccountsUseCase;
  let provisionCategories: ProvisionDefaultCategoriesUseCase;
  let provisionGroups: ProvisionDefaultGroupsUseCase;
  let provisioner: DefaultUserDataProvisioner;

  beforeEach(() => {
    executeAccounts = jest
      .fn<Promise<void>, [string, TransactionContext?]>()
      .mockResolvedValue(undefined);
    executeCategories = jest
      .fn<Promise<void>, [string, TransactionContext?]>()
      .mockResolvedValue(undefined);
    executeGroups = jest
      .fn<Promise<void>, [string, TransactionContext?]>()
      .mockResolvedValue(undefined);

    provisionAccounts = {
      execute: executeAccounts,
    } as unknown as ProvisionDefaultAccountsUseCase;
    provisionCategories = {
      execute: executeCategories,
    } as unknown as ProvisionDefaultCategoriesUseCase;
    provisionGroups = {
      execute: executeGroups,
    } as unknown as ProvisionDefaultGroupsUseCase;

    provisioner = new DefaultUserDataProvisioner(
      provisionAccounts,
      provisionCategories,
      provisionGroups,
    );
  });

  it('calls all 3 ProvisionDefault*UseCases with the same userId and tx', async () => {
    const tx = { fakeTx: true };

    await provisioner.provision('user-1', tx);

    expect(executeAccounts).toHaveBeenCalledWith('user-1', tx);
    expect(executeCategories).toHaveBeenCalledWith('user-1', tx);
    expect(executeGroups).toHaveBeenCalledWith('user-1', tx);
  });

  it('propagates a failure from ProvisionDefaultAccountsUseCase without swallowing it', async () => {
    const error = new Error('accounts provisioning failed');
    executeAccounts.mockRejectedValue(error);

    await expect(provisioner.provision('user-1')).rejects.toThrow(error);
  });

  it('propagates a failure from ProvisionDefaultCategoriesUseCase without swallowing it', async () => {
    const error = new Error('categories provisioning failed');
    executeCategories.mockRejectedValue(error);

    await expect(provisioner.provision('user-1')).rejects.toThrow(error);
  });

  it('propagates a failure from ProvisionDefaultGroupsUseCase without swallowing it', async () => {
    const error = new Error('groups provisioning failed');
    executeGroups.mockRejectedValue(error);

    await expect(provisioner.provision('user-1')).rejects.toThrow(error);
  });
});

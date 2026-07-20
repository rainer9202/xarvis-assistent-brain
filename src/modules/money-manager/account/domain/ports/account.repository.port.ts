import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { AccountEntity } from '../entities/account.entity';

export type AccountBalance = {
  account: AccountEntity;
  balanceCents: number;
};

export interface AccountRepositoryPort {
  findAll(userId: string): Promise<AccountEntity[]>;
  findById(id: string, userId: string): Promise<AccountEntity | null>;
  // tx is an optional trailing param (see TransactionRunner design decision)
  // so a batch provisioner (e.g. ProvisionDefaultAccountsUseCase) can thread
  // the same transaction client through every save() call. Existing no-arg
  // call sites (CreateAccountUseCase, etc.) are unaffected.
  save(entity: AccountEntity, tx?: TransactionContext): Promise<AccountEntity>;
  update(entity: AccountEntity): Promise<AccountEntity>;
  delete(entity: AccountEntity): Promise<void>;
  countMovementsByAccountId(accountId: string): Promise<number>;
  findAllWithBalance(userId: string): Promise<AccountBalance[]>;
  findByIdWithBalance(
    id: string,
    userId: string,
  ): Promise<AccountBalance | null>;
  countByUserId(userId: string): Promise<number>;
  setPrincipal(id: string, userId: string): Promise<void>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepositoryPort');

import { AccountEntity } from '../entities/account.entity';

export type AccountBalance = {
  account: AccountEntity;
  balanceCents: number;
};

export interface AccountRepositoryPort {
  findAll(): Promise<AccountEntity[]>;
  findById(id: string): Promise<AccountEntity | null>;
  save(entity: AccountEntity): Promise<AccountEntity>;
  update(entity: AccountEntity): Promise<AccountEntity>;
  countMovementsByAccountId(accountId: string): Promise<number>;
  findAllWithBalance(): Promise<AccountBalance[]>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepositoryPort');

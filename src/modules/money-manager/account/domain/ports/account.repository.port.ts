import { AccountEntity } from '../entities/account.entity';

export type AccountBalance = {
  account: AccountEntity;
  balanceCents: number;
};

export interface AccountRepositoryPort {
  findAll(userId: string): Promise<AccountEntity[]>;
  findById(id: string, userId: string): Promise<AccountEntity | null>;
  save(entity: AccountEntity): Promise<AccountEntity>;
  update(entity: AccountEntity): Promise<AccountEntity>;
  delete(entity: AccountEntity): Promise<void>;
  countMovementsByAccountId(accountId: string): Promise<number>;
  findAllWithBalance(userId: string): Promise<AccountBalance[]>;
  findByIdWithBalance(
    id: string,
    userId: string,
  ): Promise<AccountBalance | null>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepositoryPort');

import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { GroupEntity } from '../entities/group.entity';

export interface GroupRepositoryPort {
  findAll(userId: string): Promise<GroupEntity[]>;
  findById(id: string, userId: string): Promise<GroupEntity | null>;
  findByName(name: string, userId: string): Promise<GroupEntity | null>;
  // tx is an optional trailing param (see TransactionRunner design decision)
  // so a batch provisioner (e.g. ProvisionDefaultGroupsUseCase) can thread
  // the same transaction client through every save() call. Existing no-arg
  // call sites (CreateGroupUseCase, etc.) are unaffected.
  save(entity: GroupEntity, tx?: TransactionContext): Promise<GroupEntity>;
  update(entity: GroupEntity): Promise<GroupEntity>;
  delete(entity: GroupEntity): Promise<void>;
}

export const GROUP_REPOSITORY = Symbol('GroupRepositoryPort');

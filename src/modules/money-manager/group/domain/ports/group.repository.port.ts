import { GroupEntity } from '../entities/group.entity';

export interface GroupRepositoryPort {
  findAll(userId: string): Promise<GroupEntity[]>;
  findById(id: string, userId: string): Promise<GroupEntity | null>;
  findByName(name: string, userId: string): Promise<GroupEntity | null>;
  save(entity: GroupEntity): Promise<GroupEntity>;
  update(entity: GroupEntity): Promise<GroupEntity>;
  delete(entity: GroupEntity): Promise<void>;
}

export const GROUP_REPOSITORY = Symbol('GroupRepositoryPort');

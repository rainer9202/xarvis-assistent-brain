import { UserEntity } from '../entities/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserEntity | null>;
  findAll(): Promise<UserEntity[]>;
  create(entity: UserEntity): Promise<UserEntity>;
}

export const USER_REPOSITORY = Symbol('UserRepositoryPort');

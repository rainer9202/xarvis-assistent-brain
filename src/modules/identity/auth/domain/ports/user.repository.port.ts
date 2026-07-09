import { UserEntity } from '../entities/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserEntity | null>;
  create(entity: UserEntity): Promise<UserEntity>;
}

export const USER_REPOSITORY = Symbol('UserRepositoryPort');

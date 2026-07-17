import { UserEntity } from '../entities/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserEntity | null>;
  findAll(): Promise<UserEntity[]>;
  create(entity: UserEntity): Promise<UserEntity>;
  // Unlike Account/Category/Movement, User is the ownership root — it is
  // scoped by its own id alone, never by a second userId filter. The id
  // always comes from the caller's own verified JWT (@CurrentUser()), so
  // there is no "other user's row" case to guard against here (see ADR-1).
  findById(id: string): Promise<UserEntity | null>;
  update(entity: UserEntity): Promise<UserEntity>;
}

export const USER_REPOSITORY = Symbol('UserRepositoryPort');

import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

// emailVerified/image were pure Better-Auth leftovers with zero behavior
// anywhere in the hand-rolled JWT auth system that replaced it — removed
// from the domain entity. The Prisma User model may still have these
// columns for legacy reasons; that's untouched here, this entity simply
// stops mapping them (see PrismaUserRepository.toEntity()).
export type UserProps = BaseEntityProps & {
  name: string;
  email: string;
  password: string;
};

export class UserEntity extends BaseEntity {
  private _name: string = '';
  private _email: string = '';
  private _password: string = '';

  constructor(props?: UserProps) {
    super(props);
    if (props) {
      this._name = props.name;
      this._email = props.email;
      this._password = props.password;
    }
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get email(): string {
    return this._email;
  }

  set email(value: string) {
    this._email = value;
  }

  get password(): string {
    return this._password;
  }

  set password(value: string) {
    this._password = value;
  }
}

import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type AccountProps = BaseEntityProps & {
  name: string;
  type: string;
  userId: string;
  isActive?: boolean;
  isPrincipal?: boolean;
  creditLimitCents?: number | null;
};

export class AccountEntity extends BaseEntity {
  private _name: string = '';
  private _type: string = '';
  private _userId: string = '';
  private _isActive?: boolean;
  private _isPrincipal?: boolean;
  private _creditLimitCents?: number | null;

  constructor(props?: AccountProps) {
    super(props);
    if (props) {
      this._name = props.name;
      this._type = props.type;
      this._userId = props.userId;
      this._isActive = props.isActive;
      this._isPrincipal = props.isPrincipal;
      this._creditLimitCents = props.creditLimitCents;
    }
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get userId(): string {
    return this._userId;
  }

  get type(): string {
    return this._type;
  }

  set type(value: string) {
    this._type = value;
  }

  get isActive(): boolean | undefined {
    return this._isActive;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }

  get isPrincipal(): boolean | undefined {
    return this._isPrincipal;
  }

  set isPrincipal(value: boolean) {
    this._isPrincipal = value;
  }

  get creditLimitCents(): number | null | undefined {
    return this._creditLimitCents;
  }

  set creditLimitCents(value: number | null | undefined) {
    this._creditLimitCents = value;
  }
}

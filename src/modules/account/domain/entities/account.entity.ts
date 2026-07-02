import { BaseEntity, BaseEntityProps } from '@shared/domain/base.entity';

export type AccountProps = BaseEntityProps & {
  name: string;
  type: string;
  isActive?: boolean;
};

export class AccountEntity extends BaseEntity {
  private _name: string = '';
  private _type: string = '';
  private _isActive?: boolean;

  constructor(props?: AccountProps) {
    super(props);
    if (props) {
      this._name = props.name;
      this._type = props.type;
      this._isActive = props.isActive;
    }
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
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
}

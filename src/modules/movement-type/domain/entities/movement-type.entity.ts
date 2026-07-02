import { BaseEntity, BaseEntityProps } from '@shared/domain/base.entity';

export type MovementTypeProps = BaseEntityProps & {
  name: string;
  isDefault?: boolean;
};

export class MovementTypeEntity extends BaseEntity {
  private _name: string = '';
  private _isDefault?: boolean;

  constructor(props?: MovementTypeProps) {
    super(props);
    if (props) {
      this._name = props.name;
      this._isDefault = props.isDefault;
    }
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get isDefault(): boolean | undefined {
    return this._isDefault;
  }

  set isDefault(value: boolean) {
    this._isDefault = value;
  }
}

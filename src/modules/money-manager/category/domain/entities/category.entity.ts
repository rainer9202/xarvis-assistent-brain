import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type CategoryProps = BaseEntityProps & {
  name: string;
  icon: string;
  movementType: string;
  userId?: string | null;
  isActive?: boolean;
};

export class CategoryEntity extends BaseEntity {
  private _name: string = '';
  private _icon: string = '';
  private _movementType: string = '';
  private _userId?: string | null;
  private _isActive?: boolean;

  constructor(props?: CategoryProps) {
    super(props);
    if (props) {
      this._name = props.name;
      this._icon = props.icon;
      this._movementType = props.movementType;
      this._userId = props.userId;
      this._isActive = props.isActive;
    }
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get icon(): string {
    return this._icon;
  }

  set icon(value: string) {
    this._icon = value;
  }

  get userId(): string | null | undefined {
    return this._userId;
  }

  get movementType(): string {
    return this._movementType;
  }

  set movementType(value: string) {
    this._movementType = value;
  }

  get isActive(): boolean | undefined {
    return this._isActive;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }
}

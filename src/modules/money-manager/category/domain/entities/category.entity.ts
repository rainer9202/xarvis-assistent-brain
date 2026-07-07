import { BaseEntity, BaseEntityProps } from '@shared/domain/base.entity';

export type CategoryProps = BaseEntityProps & {
  name: string;
  movementTypeId: string;
  userId: string;
  isActive?: boolean;
};

export class CategoryEntity extends BaseEntity {
  private _name: string = '';
  private _movementTypeId: string = '';
  private _userId: string = '';
  private _isActive?: boolean;

  constructor(props?: CategoryProps) {
    super(props);
    if (props) {
      this._name = props.name;
      this._movementTypeId = props.movementTypeId;
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

  get userId(): string {
    return this._userId;
  }

  get movementTypeId(): string {
    return this._movementTypeId;
  }

  set movementTypeId(value: string) {
    this._movementTypeId = value;
  }

  get isActive(): boolean | undefined {
    return this._isActive;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }
}

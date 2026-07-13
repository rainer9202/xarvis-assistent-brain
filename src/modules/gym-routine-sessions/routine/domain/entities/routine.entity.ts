import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type RoutineProps = BaseEntityProps & {
  userId: string;
  name: string;
  isActive?: boolean;
};

export class RoutineEntity extends BaseEntity {
  private _userId: string = '';
  private _name: string = '';
  private _isActive?: boolean;

  constructor(props?: RoutineProps) {
    super(props);
    if (props) {
      this._userId = props.userId;
      this._name = props.name;
      this._isActive = props.isActive;
    }
  }

  get userId(): string {
    return this._userId;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get isActive(): boolean | undefined {
    return this._isActive;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }
}

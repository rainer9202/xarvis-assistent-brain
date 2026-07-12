import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type GroupProps = BaseEntityProps & {
  name: string;
  userId: string;
  isActive?: boolean;
  budgetCents?: number | null;
};

export class GroupEntity extends BaseEntity {
  private _name: string = '';
  private _userId: string = '';
  private _isActive?: boolean;
  private _budgetCents?: number | null;

  constructor(props?: GroupProps) {
    super(props);
    if (props) {
      this._name = props.name;
      this._userId = props.userId;
      this._isActive = props.isActive;
      this._budgetCents = props.budgetCents;
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

  get isActive(): boolean | undefined {
    return this._isActive;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }

  get budgetCents(): number | null | undefined {
    return this._budgetCents;
  }

  set budgetCents(value: number | null | undefined) {
    this._budgetCents = value;
  }
}

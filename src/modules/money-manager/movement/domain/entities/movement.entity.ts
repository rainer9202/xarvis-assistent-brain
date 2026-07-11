import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type MovementProps = BaseEntityProps & {
  amountCents: number;
  date: Date;
  note?: string;
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  movementType: string;
  groupId?: string;
  userId: string;
};

export class MovementEntity extends BaseEntity {
  private _amountCents: number = 0;
  private _date: Date = new Date();
  private _note?: string;
  private _accountId: string = '';
  private _toAccountId?: string;
  private _categoryId: string = '';
  private _movementType: string = '';
  private _groupId?: string;
  private _userId: string = '';

  constructor(props?: MovementProps) {
    super(props);
    if (props) {
      this._amountCents = props.amountCents;
      this._date = props.date;
      this._note = props.note;
      this._accountId = props.accountId;
      this._toAccountId = props.toAccountId;
      this._categoryId = props.categoryId;
      this._movementType = props.movementType;
      this._groupId = props.groupId;
      this._userId = props.userId;
    }
  }

  get amountCents(): number {
    return this._amountCents;
  }

  set amountCents(value: number) {
    this._amountCents = value;
  }

  get date(): Date {
    return this._date;
  }

  set date(value: Date) {
    this._date = value;
  }

  get note(): string | undefined {
    return this._note;
  }

  set note(value: string | undefined) {
    this._note = value;
  }

  get accountId(): string {
    return this._accountId;
  }

  set accountId(value: string) {
    this._accountId = value;
  }

  get toAccountId(): string | undefined {
    return this._toAccountId;
  }

  set toAccountId(value: string | undefined) {
    this._toAccountId = value;
  }

  get categoryId(): string {
    return this._categoryId;
  }

  set categoryId(value: string) {
    this._categoryId = value;
  }

  get movementType(): string {
    return this._movementType;
  }

  set movementType(value: string) {
    this._movementType = value;
  }

  get groupId(): string | undefined {
    return this._groupId;
  }

  set groupId(value: string | undefined) {
    this._groupId = value;
  }

  get userId(): string {
    return this._userId;
  }
}

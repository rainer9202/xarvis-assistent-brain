import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type WorkoutSessionProps = BaseEntityProps & {
  userId: string;
  routineId: string;
  date: Date;
  finishedAt?: Date | null;
};

export class WorkoutSessionEntity extends BaseEntity {
  private _userId: string = '';
  private _routineId: string = '';
  private _date: Date = new Date();
  private _finishedAt?: Date | null;

  constructor(props?: WorkoutSessionProps) {
    super(props);
    if (props) {
      this._userId = props.userId;
      this._routineId = props.routineId;
      this._date = props.date;
      this._finishedAt = props.finishedAt;
    }
  }

  get userId(): string {
    return this._userId;
  }

  get routineId(): string {
    return this._routineId;
  }

  get date(): Date {
    return this._date;
  }

  get finishedAt(): Date | null | undefined {
    return this._finishedAt;
  }

  set finishedAt(value: Date | null | undefined) {
    this._finishedAt = value;
  }
}

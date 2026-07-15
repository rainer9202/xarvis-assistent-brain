import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type BodyMetricProps = BaseEntityProps & {
  userId: string;
  weightGrams: number;
  heightCm: number;
  measuredAt: Date;
};

export class BodyMetricEntity extends BaseEntity {
  private _userId: string = '';
  private _weightGrams: number = 0;
  private _heightCm: number = 0;
  private _measuredAt: Date = new Date();

  constructor(props?: BodyMetricProps) {
    super(props);
    if (props) {
      this._userId = props.userId;
      this._weightGrams = props.weightGrams;
      this._heightCm = props.heightCm;
      this._measuredAt = props.measuredAt;
    }
  }

  get userId(): string {
    return this._userId;
  }

  get weightGrams(): number {
    return this._weightGrams;
  }

  set weightGrams(value: number) {
    this._weightGrams = value;
  }

  get heightCm(): number {
    return this._heightCm;
  }

  set heightCm(value: number) {
    this._heightCm = value;
  }

  get measuredAt(): Date {
    return this._measuredAt;
  }

  set measuredAt(value: Date) {
    this._measuredAt = value;
  }
}

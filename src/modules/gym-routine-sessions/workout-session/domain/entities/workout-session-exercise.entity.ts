import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type WorkoutSessionExerciseProps = BaseEntityProps & {
  workoutSessionId: string;
  exerciseId: string;
  actualSets: number;
  actualReps: number;
  actualWeightGrams: number;
};

export class WorkoutSessionExerciseEntity extends BaseEntity {
  private _workoutSessionId: string = '';
  private _exerciseId: string = '';
  private _actualSets: number = 0;
  private _actualReps: number = 0;
  private _actualWeightGrams: number = 0;

  constructor(props?: WorkoutSessionExerciseProps) {
    super(props);
    if (props) {
      this._workoutSessionId = props.workoutSessionId;
      this._exerciseId = props.exerciseId;
      this._actualSets = props.actualSets;
      this._actualReps = props.actualReps;
      this._actualWeightGrams = props.actualWeightGrams;
    }
  }

  get workoutSessionId(): string {
    return this._workoutSessionId;
  }

  get exerciseId(): string {
    return this._exerciseId;
  }

  get actualSets(): number {
    return this._actualSets;
  }

  set actualSets(value: number) {
    this._actualSets = value;
  }

  get actualReps(): number {
    return this._actualReps;
  }

  set actualReps(value: number) {
    this._actualReps = value;
  }

  get actualWeightGrams(): number {
    return this._actualWeightGrams;
  }

  set actualWeightGrams(value: number) {
    this._actualWeightGrams = value;
  }
}

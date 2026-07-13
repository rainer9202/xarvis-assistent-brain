import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type RoutineExerciseProps = BaseEntityProps & {
  routineId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: number;
  targetWeightGrams: number;
};

// Has no independent use-cases/controller — it's managed entirely as part of
// Routine's own create/update payload (see routine.repository.port.ts's
// save/update signatures). Still extends BaseEntity for consistency since it
// is a real DB row with its own id/timestamps, even though the repository
// manages it directly rather than through a dedicated port.
export class RoutineExerciseEntity extends BaseEntity {
  private _routineId: string = '';
  private _exerciseId: string = '';
  private _order: number = 0;
  private _targetSets: number = 0;
  private _targetReps: number = 0;
  private _targetWeightGrams: number = 0;

  constructor(props?: RoutineExerciseProps) {
    super(props);
    if (props) {
      this._routineId = props.routineId;
      this._exerciseId = props.exerciseId;
      this._order = props.order;
      this._targetSets = props.targetSets;
      this._targetReps = props.targetReps;
      this._targetWeightGrams = props.targetWeightGrams;
    }
  }

  get routineId(): string {
    return this._routineId;
  }

  get exerciseId(): string {
    return this._exerciseId;
  }

  get order(): number {
    return this._order;
  }

  get targetSets(): number {
    return this._targetSets;
  }

  get targetReps(): number {
    return this._targetReps;
  }

  get targetWeightGrams(): number {
    return this._targetWeightGrams;
  }
}

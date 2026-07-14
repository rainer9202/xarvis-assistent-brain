import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type ExerciseProps = BaseEntityProps & {
  userId?: string | null;
  name: string;
  nameEs?: string | null;
  category?: string | null;
  bodyPart?: string | null;
  equipment?: string | null;
  target?: string | null;
  muscleGroup?: string | null;
  secondaryMuscles?: string[];
  instructions?: Record<string, string> | null;
  image?: string | null;
  gifUrl?: string | null;
  attribution?: string | null;
};

export class ExerciseEntity extends BaseEntity {
  private _userId?: string | null;
  private _name: string = '';
  private _nameEs?: string | null;
  private _category?: string | null;
  private _bodyPart?: string | null;
  private _equipment?: string | null;
  private _target?: string | null;
  private _muscleGroup?: string | null;
  private _secondaryMuscles?: string[];
  private _instructions?: Record<string, string> | null;
  private _image?: string | null;
  private _gifUrl?: string | null;
  private _attribution?: string | null;

  constructor(props?: ExerciseProps) {
    super(props);
    if (props) {
      this._userId = props.userId;
      this._name = props.name;
      this._nameEs = props.nameEs;
      this._category = props.category;
      this._bodyPart = props.bodyPart;
      this._equipment = props.equipment;
      this._target = props.target;
      this._muscleGroup = props.muscleGroup;
      this._secondaryMuscles = props.secondaryMuscles;
      this._instructions = props.instructions;
      this._image = props.image;
      this._gifUrl = props.gifUrl;
      this._attribution = props.attribution;
    }
  }

  get userId(): string | null | undefined {
    return this._userId;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  get nameEs(): string | null | undefined {
    return this._nameEs;
  }

  get category(): string | null | undefined {
    return this._category;
  }

  set category(value: string | null | undefined) {
    this._category = value;
  }

  get bodyPart(): string | null | undefined {
    return this._bodyPart;
  }

  set bodyPart(value: string | null | undefined) {
    this._bodyPart = value;
  }

  get equipment(): string | null | undefined {
    return this._equipment;
  }

  set equipment(value: string | null | undefined) {
    this._equipment = value;
  }

  get target(): string | null | undefined {
    return this._target;
  }

  set target(value: string | null | undefined) {
    this._target = value;
  }

  get muscleGroup(): string | null | undefined {
    return this._muscleGroup;
  }

  set muscleGroup(value: string | null | undefined) {
    this._muscleGroup = value;
  }

  get secondaryMuscles(): string[] | undefined {
    return this._secondaryMuscles;
  }

  get instructions(): Record<string, string> | null | undefined {
    return this._instructions;
  }

  get image(): string | null | undefined {
    return this._image;
  }

  get gifUrl(): string | null | undefined {
    return this._gifUrl;
  }

  get attribution(): string | null | undefined {
    return this._attribution;
  }
}

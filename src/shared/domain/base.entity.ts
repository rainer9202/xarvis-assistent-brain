export type BaseEntityProps = {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export abstract class BaseEntity {
  private _id?: string;
  private _createdAt?: Date;
  private _updatedAt?: Date;

  protected constructor(props?: BaseEntityProps) {
    if (props) {
      this._id = props.id;
      this._createdAt = props.createdAt;
      this._updatedAt = props.updatedAt;
    }
  }

  get id(): string | undefined {
    return this._id;
  }

  set id(value: string) {
    this._id = value;
  }

  get createdAt(): Date | undefined {
    return this._createdAt;
  }

  set createdAt(value: Date) {
    this._createdAt = value;
  }

  get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  set updatedAt(value: Date) {
    this._updatedAt = value;
  }
}

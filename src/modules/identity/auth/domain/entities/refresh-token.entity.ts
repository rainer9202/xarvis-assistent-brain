import { BaseEntity, BaseEntityProps } from '@domain/base.entity';

export type RefreshTokenProps = BaseEntityProps & {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt?: Date | null;
};

export class RefreshTokenEntity extends BaseEntity {
  private _tokenHash: string = '';
  private _userId: string = '';
  private _expiresAt: Date = new Date(0);
  private _revokedAt?: Date | null;

  constructor(props?: RefreshTokenProps) {
    super(props);
    if (props) {
      this._tokenHash = props.tokenHash;
      this._userId = props.userId;
      this._expiresAt = props.expiresAt;
      this._revokedAt = props.revokedAt;
    }
  }

  get tokenHash(): string {
    return this._tokenHash;
  }

  set tokenHash(value: string) {
    this._tokenHash = value;
  }

  get userId(): string {
    return this._userId;
  }

  set userId(value: string) {
    this._userId = value;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  set expiresAt(value: Date) {
    this._expiresAt = value;
  }

  get revokedAt(): Date | null | undefined {
    return this._revokedAt;
  }

  set revokedAt(value: Date | null | undefined) {
    this._revokedAt = value;
  }
}

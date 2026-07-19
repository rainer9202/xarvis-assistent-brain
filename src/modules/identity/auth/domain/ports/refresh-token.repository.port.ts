import { RefreshTokenEntity } from '../entities/refresh-token.entity';

export interface RefreshTokenRepositoryPort {
  create(entity: RefreshTokenEntity): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  // Rotation: revokes the row backing the presented (now-exchanged) refresh
  // token by entity, once it's already been looked up via findByHash.
  revoke(entity: RefreshTokenEntity): Promise<void>;
  // Logout: revokes by hash directly (no prior findByHash needed) and is
  // idempotent — a no-op, not an error, when no row matches the hash (see
  // spec's "Logout is idempotent" scenario).
  revokeByHash(tokenHash: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepositoryPort');

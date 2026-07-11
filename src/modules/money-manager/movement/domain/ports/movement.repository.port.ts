import { MovementEntity } from '../entities/movement.entity';

export type MovementFilters = {
  accountId?: string;
  categoryId?: string[];
  movementType?: string;
  groupId?: string;
  // Calendar month in YYYY-MM format, UTC.
  month?: string;
  // When true (and month is absent), skip the default last-3-months window
  // and return full history.
  historic?: boolean;
};

export interface MovementRepositoryPort {
  findAll(userId: string, filters?: MovementFilters): Promise<MovementEntity[]>;
  findById(id: string, userId: string): Promise<MovementEntity | null>;
  save(entity: MovementEntity): Promise<MovementEntity>;
  update(entity: MovementEntity): Promise<MovementEntity>;
  delete(entity: MovementEntity): Promise<void>;
}

export const MOVEMENT_REPOSITORY = Symbol('MovementRepositoryPort');

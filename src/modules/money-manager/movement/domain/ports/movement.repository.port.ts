import { MovementEntity } from '../entities/movement.entity';

export type MovementFilters = {
  accountId?: string;
  movementType?: string;
  // Calendar month in YYYY-MM format, UTC.
  month?: string;
};

export interface MovementRepositoryPort {
  findAll(userId: string, filters?: MovementFilters): Promise<MovementEntity[]>;
  findById(id: string, userId: string): Promise<MovementEntity | null>;
  save(entity: MovementEntity): Promise<MovementEntity>;
  update(entity: MovementEntity): Promise<MovementEntity>;
  delete(entity: MovementEntity): Promise<void>;
}

export const MOVEMENT_REPOSITORY = Symbol('MovementRepositoryPort');

import { MovementEntity } from '../entities/movement.entity';

export interface MovementRepositoryPort {
  findAll(userId: string): Promise<MovementEntity[]>;
  findById(id: string, userId: string): Promise<MovementEntity | null>;
  save(entity: MovementEntity): Promise<MovementEntity>;
  update(entity: MovementEntity): Promise<MovementEntity>;
  delete(entity: MovementEntity): Promise<void>;
}

export const MOVEMENT_REPOSITORY = Symbol('MovementRepositoryPort');

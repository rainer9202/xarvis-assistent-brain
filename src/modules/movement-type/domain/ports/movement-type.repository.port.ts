import { MovementTypeEntity } from '../entities/movement-type.entity';

export interface MovementTypeRepositoryPort {
  findAll(): Promise<MovementTypeEntity[]>;
  findById(id: string): Promise<MovementTypeEntity | null>;
  findByName(name: string): Promise<MovementTypeEntity | null>;
  save(entity: MovementTypeEntity): Promise<MovementTypeEntity>;
  delete(entity: MovementTypeEntity): Promise<void>;
}

export const MOVEMENT_TYPE_REPOSITORY = Symbol('MovementTypeRepositoryPort');

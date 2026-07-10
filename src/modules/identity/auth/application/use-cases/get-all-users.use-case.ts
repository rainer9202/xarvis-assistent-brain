import { Inject, Injectable } from '@nestjs/common';
import { UserEntity } from '../../domain/entities/user.entity';
import { DomainException } from '@domain/exceptions/domain.exception';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';

export type GetAllUsersResponse = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

@Injectable()
export class GetAllUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: UserRepositoryPort,
  ) {}

  async execute(): Promise<GetAllUsersResponse[]> {
    try {
      const entities = await this.repository.findAll();
      return entities.map((item: UserEntity) => ({
        id: item.id!,
        name: item.name,
        email: item.email,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching users: ${error}`);
    }
  }
}

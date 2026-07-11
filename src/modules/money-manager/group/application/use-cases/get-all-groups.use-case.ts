import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { GROUP_REPOSITORY } from '../../domain/ports/group.repository.port';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';

export type GetAllGroupsResponse = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
};

@Injectable()
export class GetAllGroupsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly repository: GroupRepositoryPort,
  ) {}

  async execute(userId: string): Promise<GetAllGroupsResponse[]> {
    try {
      const entities = await this.repository.findAll(userId);
      return entities.map((item) => ({
        id: item.id!,
        name: item.name,
        isActive: item.isActive!,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching groups: ${error}`);
    }
  }
}

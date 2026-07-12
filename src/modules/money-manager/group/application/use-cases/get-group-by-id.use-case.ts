import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { GROUP_REPOSITORY } from '../../domain/ports/group.repository.port';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';

export type GetGroupByIdResponse = {
  id: string;
  name: string;
  isActive: boolean;
  budgetCents: number | null;
};

@Injectable()
export class GetGroupByIdUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly repository: GroupRepositoryPort,
  ) {}

  async execute(id: string, userId: string): Promise<GetGroupByIdResponse> {
    try {
      const group = await this.repository.findById(id, userId);
      if (!group) throw new NotFoundException(`Group "${id}" not found`);

      return {
        id: group.id!,
        name: group.name,
        isActive: group.isActive!,
        budgetCents: group.budgetCents ?? null,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching group: ${error}`);
    }
  }
}

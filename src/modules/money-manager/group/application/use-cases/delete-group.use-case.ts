import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { GROUP_REPOSITORY } from '../../domain/ports/group.repository.port';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';

export type DeleteGroupResponse = {
  id: string;
};

export class DeleteGroupCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly repository: GroupRepositoryPort,
  ) {}

  async execute(command: DeleteGroupCommand): Promise<DeleteGroupResponse> {
    try {
      const group = await this.repository.findById(command.id, command.userId);
      if (!group)
        throw new NotFoundException(`Group "${command.id}" not found`);

      // No delete-guard: nothing in the schema references Group yet
      // (Category isn't linked to it — this is a standalone CRUD for now).
      await this.repository.delete(group);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting group: ${error}`);
    }
  }
}

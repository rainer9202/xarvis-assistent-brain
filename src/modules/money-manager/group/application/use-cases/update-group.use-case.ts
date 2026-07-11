import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { GROUP_REPOSITORY } from '../../domain/ports/group.repository.port';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';

export type UpdateGroupResponse = {
  id: string;
};

export class UpdateGroupCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly isActive?: boolean,
  ) {}
}

@Injectable()
export class UpdateGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly repository: GroupRepositoryPort,
  ) {}

  async execute(command: UpdateGroupCommand): Promise<UpdateGroupResponse> {
    try {
      const group = await this.repository.findById(command.id, command.userId);
      if (!group)
        throw new NotFoundException(`Group "${command.id}" not found`);

      if (command.name !== undefined && command.name !== group.name) {
        const existing = await this.repository.findByName(
          command.name,
          command.userId,
        );
        if (existing && existing.id !== group.id)
          throw new ConflictException(`Group "${command.name}" already exists`);
        group.name = command.name;
      }
      if (command.isActive !== undefined) group.isActive = command.isActive;

      const saved = await this.repository.update(group);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating group: ${error}`);
    }
  }
}

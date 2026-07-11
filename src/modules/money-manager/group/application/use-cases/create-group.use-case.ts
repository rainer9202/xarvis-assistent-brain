import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
} from '@domain/exceptions/domain.exception';
import { GroupEntity } from '../../domain/entities/group.entity';
import { GROUP_REPOSITORY } from '../../domain/ports/group.repository.port';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';

export type CreateGroupResponse = {
  id: string;
};

export class CreateGroupCommand {
  constructor(
    public readonly name: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class CreateGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly repository: GroupRepositoryPort,
  ) {}

  async execute(command: CreateGroupCommand): Promise<CreateGroupResponse> {
    try {
      const existing = await this.repository.findByName(
        command.name,
        command.userId,
      );
      if (existing)
        throw new ConflictException(`Group "${command.name}" already exists`);

      const entity = new GroupEntity({
        name: command.name,
        userId: command.userId,
        isActive: true,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating group: ${error}`);
    }
  }
}

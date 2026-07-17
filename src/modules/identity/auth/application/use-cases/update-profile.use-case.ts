import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { buildUserProfile } from '../shared/build-user-profile';
import type { UserProfileResponse } from '../shared/build-user-profile';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';

// Deliberately returns the FULL UserProfileResponse instead of AGENTS.md
// review rule #9's default "Update returns { id: string } only": this is a
// documented exception, in the exact same spirit as SignUpUseCase returning
// { id, accessToken } instead of { id } (see sign-up.use-case.ts's
// SignUpResponse). Design rationale is design.md ADR-4 — the client
// refreshes its local profile store from this one round-trip instead of a
// follow-up GET, and reusing GetProfileUseCase's buildUserProfile() mapper
// guarantees the two responses are provably identical in shape. Do NOT
// "fix" this back to { id } — that would break the documented contract.
export type UpdateProfileResponse = UserProfileResponse;

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly name?: string,
    public readonly birthDate?: string,
  ) {}
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: UserRepositoryPort,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<UpdateProfileResponse> {
    try {
      const user = await this.repository.findById(command.userId);
      if (!user)
        throw new NotFoundException(`User "${command.userId}" not found`);

      // Hydrate first, then mutate only the fields present in the command —
      // this is what makes a single-field PATCH leave the other field
      // untouched (design.md ADR-3).
      if (command.name !== undefined) user.name = command.name;
      if (command.birthDate !== undefined)
        user.birthDate = new Date(command.birthDate);

      const saved = await this.repository.update(user);

      return buildUserProfile(saved);
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating profile: ${error}`);
    }
  }
}

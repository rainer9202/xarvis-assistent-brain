import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { buildUserProfile } from '../shared/build-user-profile';
import type { UserProfileResponse } from '../shared/build-user-profile';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';

export type GetProfileResponse = UserProfileResponse;

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: UserRepositoryPort,
  ) {}

  async execute(userId: string): Promise<GetProfileResponse> {
    try {
      const user = await this.repository.findById(userId);
      // A deleted user's still-unexpired JWT continues to authenticate (see
      // AGENTS.md's stateless-JWT tradeoff and design.md ADR-1) — a valid
      // token for a since-deleted row is reachable and must yield 404, not
      // a 500 or a silently-empty profile.
      if (!user) throw new NotFoundException(`User "${userId}" not found`);

      return buildUserProfile(user);
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching profile: ${error}`);
    }
  }
}

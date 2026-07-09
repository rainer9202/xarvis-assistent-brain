import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConflictException } from '@shared/exceptions/domain.exception';
import { buildAuthResponse } from '../shared/build-auth-response';
import type { AuthResponse } from '../shared/build-auth-response';
import { UserEntity } from '../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';

// Deliberately returns { id, accessToken } instead of AGENTS.md's default
// "Create returns { id: string } only" rule: the client needs a working
// session immediately after registering, so this is a documented exception,
// not an oversight.
export type SignUpResponse = AuthResponse;

export class SignUpCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
  ) {}
}

@Injectable()
export class SignUpUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: UserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: SignUpCommand): Promise<SignUpResponse> {
    const existing = await this.repository.findByEmail(command.email);
    if (existing) {
      throw new ConflictException(
        `Email "${command.email}" is already registered`,
      );
    }

    const hashedPassword = await argon2.hash(command.password);
    const entity = new UserEntity({
      name: command.name,
      email: command.email,
      password: hashedPassword,
    });
    const saved = await this.repository.create(entity);

    return buildAuthResponse(this.jwtService, saved);
  }
}

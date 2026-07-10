import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { UserModel } from '@config/database/generated/prisma/models.js';
import { ConflictException } from '@domain/exceptions/domain.exception';
import { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepositoryPort } from '../../domain/ports/user.repository.port';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? this.toEntity(record) : null;
  }

  async findAll(): Promise<UserEntity[]> {
    const records = await this.prisma.user.findMany();
    return records.map((record) => this.toEntity(record));
  }

  async create(entity: UserEntity): Promise<UserEntity> {
    try {
      const record = await this.prisma.user.create({
        data: {
          name: entity.name,
          email: entity.email,
          password: entity.password,
        },
      });

      return this.toEntity(record);
    } catch (error) {
      // Closes the TOCTOU race in SignUpUseCase: two concurrent sign-ups for
      // the same email can both pass its findByEmail check, so the losing
      // create() hits the DB's unique constraint on `email` (Prisma error
      // code P2002) instead of returning a clean 409. Duck-typed on
      // `error.code` rather than `instanceof
      // Prisma.PrismaClientKnownRequestError` — a real value import of the
      // generated client here would make ts-jest try to transform
      // client.ts's genuine ESM (`import.meta.url`), which fails to parse
      // under ts-jest's CommonJS transform (the same constraint AGENTS.md
      // documents for why e2e specs need @swc/jest instead).
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          `Email "${entity.email}" is already registered`,
        );
      }
      throw error;
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private toEntity(record: UserModel): UserEntity {
    return new UserEntity({
      id: record.id,
      name: record.name,
      email: record.email,
      password: record.password,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}

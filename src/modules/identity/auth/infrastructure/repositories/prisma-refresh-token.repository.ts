import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { RefreshTokenModel } from '@config/database/generated/prisma/models.js';
import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import type { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token.repository.port';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(entity: RefreshTokenEntity): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: entity.tokenHash,
        userId: entity.userId,
        expiresAt: entity.expiresAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return record ? this.toEntity(record) : null;
  }

  async revoke(entity: RefreshTokenEntity): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: entity.id },
      data: { revokedAt: new Date() },
    });
  }

  // Idempotent by design (spec's "Logout is idempotent" scenario): updateMany
  // simply matches zero rows when the hash is unknown or already revoked,
  // instead of update()'s throw-on-missing-row behavior — a defensive
  // re-revoke is a silent no-op, never a surfaced error.
  async revokeByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  private toEntity(record: RefreshTokenModel): RefreshTokenEntity {
    return new RefreshTokenEntity({
      id: record.id,
      tokenHash: record.tokenHash,
      userId: record.userId,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}

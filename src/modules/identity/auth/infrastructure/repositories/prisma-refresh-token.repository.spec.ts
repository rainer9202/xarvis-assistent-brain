// PrismaService itself is mocked before any other import so that requiring
// PrismaRefreshTokenRepository never pulls in the real generated Prisma
// client (ts-jest does not auto-hoist jest.mock() the way babel-jest does,
// so this call must stay above the imports it affects) — see the identical
// pattern in prisma-user.repository.spec.ts.
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import { PrismaRefreshTokenRepository } from './prisma-refresh-token.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaRefreshTokenRepository', () => {
  let repository: PrismaRefreshTokenRepository;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  const record = {
    id: 'token-1',
    tokenHash: 'hashed-token',
    userId: 'user-1',
    expiresAt: new Date('2026-08-19T00:00:00Z'),
    revokedAt: null,
    createdAt: new Date('2026-07-19T00:00:00Z'),
    updatedAt: new Date('2026-07-19T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    repository = new PrismaRefreshTokenRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('persists the token hash, userId, and expiry', async () => {
      const entity = new RefreshTokenEntity({
        tokenHash: 'hashed-token',
        userId: 'user-1',
        expiresAt: new Date('2026-08-19T00:00:00Z'),
      });
      prisma.refreshToken.create.mockResolvedValue(record);

      await repository.create(entity);

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          tokenHash: 'hashed-token',
          userId: 'user-1',
          expiresAt: new Date('2026-08-19T00:00:00Z'),
        },
      });
    });
  });

  describe('findByHash', () => {
    it('returns the mapped entity when found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(record);

      const result = await repository.findByHash('hashed-token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-token' },
      });
      expect(result).toBeInstanceOf(RefreshTokenEntity);
      expect(result?.tokenHash).toBe('hashed-token');
      expect(result?.revokedAt).toBeNull();
    });

    it('returns null when not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      const result = await repository.findByHash('missing-hash');

      expect(result).toBeNull();
    });
  });

  describe('revoke', () => {
    it('sets revokedAt to now for the given entity', async () => {
      const entity = new RefreshTokenEntity({
        id: 'token-1',
        tokenHash: 'hashed-token',
        userId: 'user-1',
        expiresAt: new Date('2026-08-19T00:00:00Z'),
      });
      prisma.refreshToken.update.mockResolvedValue({
        ...record,
        revokedAt: new Date(),
      });

      await repository.revoke(entity);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('revokeByHash', () => {
    it('revokes the row matching the hash', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await repository.revokeByHash('hashed-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-token' },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('is idempotent — a no-op (not an error) when no row matches the hash', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repository.revokeByHash('missing-hash'),
      ).resolves.toBeUndefined();
    });
  });
});

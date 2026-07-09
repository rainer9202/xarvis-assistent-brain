// PrismaService itself is mocked before any other import so that requiring
// `PrismaUserRepository` never pulls in the real generated Prisma client
// (ts-jest does not auto-hoist jest.mock() the way babel-jest does, so this
// call must stay above the imports it affects) — see the identical pattern
// in prisma-account.repository.spec.ts.
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ConflictException } from '@shared/exceptions/domain.exception';
import { UserEntity } from '../../domain/entities/user.entity';
import { PrismaUserRepository } from './prisma-user.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  // UserEntity no longer maps emailVerified/image (dropped from the schema
  // in the Better-Auth removal) — kept out of this fixture on purpose so it
  // doesn't silently re-introduce those vestigial fields.
  const record = {
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'hashed-password',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    repository = new PrismaUserRepository(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('returns the mapped entity when found', async () => {
      prisma.user.findUnique.mockResolvedValue(record);

      const result = await repository.findByEmail('jane@example.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
      });
      expect(result).toBeInstanceOf(UserEntity);
      expect(result?.email).toBe('jane@example.com');
    });

    it('returns null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a record from the entity and returns the mapped entity', async () => {
      const entity = new UserEntity({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'hashed-password',
      });
      prisma.user.create.mockResolvedValue(record);

      const result = await repository.create(entity);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'hashed-password',
        },
      });
      expect(result).toBeInstanceOf(UserEntity);
      expect(result.id).toBe('user-1');
    });

    // Closes the TOCTOU race in SignUpUseCase: two concurrent sign-ups for
    // the same email can both pass its findByEmail check, so the second
    // prisma.user.create() hits the DB's unique constraint on `email` and
    // throws a Prisma unique-constraint violation (code P2002). Duck-typed
    // on `error.code` rather than `instanceof
    // Prisma.PrismaClientKnownRequestError`: a real *value* import of the
    // generated client from this repository would make ts-jest try to
    // transform client.ts itself, which contains genuine ESM
    // (`import.meta.url`) and fails to parse under ts-jest's CommonJS
    // transform — the same ESM constraint AGENTS.md documents for why e2e
    // specs need @swc/jest instead. Every other repository in this codebase
    // only ever imports the generated client as `import type` for exactly
    // this reason.
    it('maps a P2002 unique-constraint violation to ConflictException', async () => {
      const entity = new UserEntity({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'hashed-password',
      });
      prisma.user.create.mockRejectedValue(
        Object.assign(
          new Error('Unique constraint failed on the fields: (`email`)'),
          { code: 'P2002', meta: { target: ['email'] } },
        ),
      );

      await expect(repository.create(entity)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows any other error unchanged', async () => {
      const entity = new UserEntity({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'hashed-password',
      });
      const unexpected = new Error('connection refused');
      prisma.user.create.mockRejectedValue(unexpected);

      await expect(repository.create(entity)).rejects.toThrow(
        'connection refused',
      );
    });
  });
});

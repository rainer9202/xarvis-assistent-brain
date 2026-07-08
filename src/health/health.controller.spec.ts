// PrismaService itself is mocked before any other import so that requiring
// HealthController never pulls in the real generated Prisma client (ts-jest
// does not auto-hoist jest.mock() the way babel-jest does, so this call must
// stay above the imports it affects) — same pattern as the repository specs.
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@config/database/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns database up when the query succeeds', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result).toEqual({ message: 'ok', data: { database: 'up' } });
  });

  it('throws ServiceUnavailableException when the database query rejects', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateBodyMetricCommand,
  CreateBodyMetricUseCase,
} from '../../application/use-cases/create-body-metric.use-case';
import {
  UpdateBodyMetricCommand,
  UpdateBodyMetricUseCase,
} from '../../application/use-cases/update-body-metric.use-case';
import {
  DeleteBodyMetricCommand,
  DeleteBodyMetricUseCase,
} from '../../application/use-cases/delete-body-metric.use-case';
import { GetAllBodyMetricsUseCase } from '../../application/use-cases/get-all-body-metrics.use-case';
import { GetBodyMetricByIdUseCase } from '../../application/use-cases/get-body-metric-by-id.use-case';
import { CreateBodyMetricDto } from '../dto/create-body-metric.dto';
import { UpdateBodyMetricDto } from '../dto/update-body-metric.dto';
import { GetBodyMetricsQueryDto } from '../dto/get-body-metrics-query.dto';
import { BodyMetricController } from './body-metric.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('BodyMetricController', () => {
  let controller: BodyMetricController;
  let getAllExecute: jest.Mock;
  let getByIdExecute: jest.Mock;
  let createExecute: jest.Mock;
  let updateExecute: jest.Mock;
  let removeExecute: jest.Mock;

  beforeEach(async () => {
    getAllExecute = jest.fn();
    getByIdExecute = jest.fn();
    createExecute = jest.fn();
    updateExecute = jest.fn();
    removeExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BodyMetricController],
      providers: [
        {
          provide: GetAllBodyMetricsUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: GetBodyMetricByIdUseCase,
          useValue: { execute: getByIdExecute },
        },
        {
          provide: CreateBodyMetricUseCase,
          useValue: { execute: createExecute },
        },
        {
          provide: UpdateBodyMetricUseCase,
          useValue: { execute: updateExecute },
        },
        {
          provide: DeleteBodyMetricUseCase,
          useValue: { execute: removeExecute },
        },
      ],
    }).compile();

    controller = module.get(BodyMetricController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllBodyMetricsUseCase and returns items as data with no pagination keys when unpaginated', async () => {
      const items = [
        {
          id: 'metric-1',
          weightGrams: 75000,
          heightCm: 178,
          measuredAt: new Date('2026-07-14T10:00:00.000Z'),
          createdAt: new Date('2026-07-14T10:05:00.000Z'),
        },
      ];
      getAllExecute.mockResolvedValue({ items });

      const query: GetBodyMetricsQueryDto = {};
      const result = await controller.findAll(query, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, undefined, undefined);
      expect(result).toEqual({
        message: 'Get all body-metrics successfully',
        data: items,
      });
      expect(result).not.toHaveProperty('page');
      expect(result).not.toHaveProperty('totalCount');
    });

    it('adds page/limit/totalCount/totalPages/hasMore as siblings of data when paginated', async () => {
      const items = [{ id: 'metric-1' }];
      getAllExecute.mockResolvedValue({
        items,
        pagination: {
          page: 1,
          limit: 10,
          totalCount: 25,
          totalPages: 3,
          hasMore: true,
        },
      });

      const query: GetBodyMetricsQueryDto = { page: 1, limit: 10 };
      const result = await controller.findAll(query, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, 1, 10);
      expect(result).toEqual({
        message: 'Get all body-metrics successfully',
        data: items,
        page: 1,
        limit: 10,
        totalCount: 25,
        totalPages: 3,
        hasMore: true,
      });
    });
  });

  describe('findOne', () => {
    it('delegates to GetBodyMetricByIdUseCase', async () => {
      const data = {
        id: 'metric-1',
        weightGrams: 75000,
        heightCm: 178,
        measuredAt: new Date('2026-07-14T10:00:00.000Z'),
        createdAt: new Date('2026-07-14T10:05:00.000Z'),
      };
      getByIdExecute.mockResolvedValue(data);

      const result = await controller.findOne('metric-1', user);

      expect(getByIdExecute).toHaveBeenCalledWith('metric-1', user.id);
      expect(result).toEqual({
        message: 'Get body-metrics successfully',
        data,
      });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateBodyMetricUseCase with a command built from the dto and CurrentUser, never trusting a body userId', async () => {
      const dto: CreateBodyMetricDto = {
        weightGrams: 75000,
        heightCm: 178,
        measuredAt: '2026-07-14T10:00:00.000Z',
      };
      let receivedCommand: CreateBodyMetricCommand | undefined;
      createExecute.mockImplementation((command: CreateBodyMetricCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'metric-1' });
      });

      const result = await controller.createOne(dto, user);

      expect(receivedCommand).toBeInstanceOf(CreateBodyMetricCommand);
      expect(receivedCommand).toEqual(
        expect.objectContaining({
          userId: user.id,
          weightGrams: 75000,
          heightCm: 178,
        }),
      );
      expect(receivedCommand?.measuredAt).toEqual(
        new Date('2026-07-14T10:00:00.000Z'),
      );
      expect(result).toEqual({
        message: 'The body-metrics was created successfully',
        data: { id: 'metric-1' },
      });
    });

    it('leaves measuredAt undefined when the dto omits it, so the use case defaults to now', async () => {
      const dto: CreateBodyMetricDto = { weightGrams: 75000, heightCm: 178 };
      let receivedCommand: CreateBodyMetricCommand | undefined;
      createExecute.mockImplementation((command: CreateBodyMetricCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'metric-1' });
      });

      await controller.createOne(dto, user);

      expect(receivedCommand?.measuredAt).toBeUndefined();
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateBodyMetricUseCase', async () => {
      const dto: UpdateBodyMetricDto = { weightGrams: 76000 };
      let receivedCommand: UpdateBodyMetricCommand | undefined;
      updateExecute.mockImplementation((command: UpdateBodyMetricCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'metric-1' });
      });

      const result = await controller.updateOne('metric-1', dto, user);

      expect(receivedCommand).toBeInstanceOf(UpdateBodyMetricCommand);
      expect(receivedCommand).toEqual(
        expect.objectContaining({
          id: 'metric-1',
          userId: user.id,
          weightGrams: 76000,
        }),
      );
      expect(result).toEqual({
        message: 'The body-metrics was updated successfully',
        data: { id: 'metric-1' },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteBodyMetricUseCase', async () => {
      let receivedCommand: DeleteBodyMetricCommand | undefined;
      removeExecute.mockImplementation((command: DeleteBodyMetricCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'metric-1' });
      });

      const result = await controller.deleteOne('metric-1', user);

      expect(receivedCommand).toBeInstanceOf(DeleteBodyMetricCommand);
      expect(receivedCommand).toEqual(
        expect.objectContaining({ id: 'metric-1', userId: user.id }),
      );
      expect(result).toEqual({
        message: 'The body-metrics was deleted successfully',
        data: { id: 'metric-1' },
      });
    });
  });
});

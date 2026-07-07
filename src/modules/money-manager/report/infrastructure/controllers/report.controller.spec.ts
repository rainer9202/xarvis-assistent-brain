import { Test, TestingModule } from '@nestjs/testing';
import { GetBalanceReportUseCase } from '../../application/use-cases/get-balance-report.use-case';
import { ReportController } from './report.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('ReportController', () => {
  let controller: ReportController;
  let getBalanceReportExecute: jest.Mock;

  beforeEach(async () => {
    getBalanceReportExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: GetBalanceReportUseCase,
          useValue: { execute: getBalanceReportExecute },
        },
      ],
    }).compile();

    controller = module.get(ReportController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('delegates to GetBalanceReportUseCase and returns { message, data }', async () => {
      const report = {
        accounts: [{ id: 'acc-1', name: 'Checking', balanceCents: -2500 }],
        totalBalanceCents: -2500,
      };
      getBalanceReportExecute.mockResolvedValue(report);

      const result = await controller.getBalance(user);

      expect(getBalanceReportExecute).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        message: 'Balance report generated successfully',
        data: report,
      });
    });
  });
});

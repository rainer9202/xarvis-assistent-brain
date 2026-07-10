import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetBalanceReportUseCase } from '../../application/use-cases/get-balance-report.use-case';
import { CurrentUser } from '@infra/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '@infra/decorators/current-user.decorator';

@ApiTags('reports')
@Controller('reports')
export class ReportController {
  constructor(private readonly getBalanceReport: GetBalanceReportUseCase) {}

  @Get('balance')
  @ApiOkResponse({
    description: 'Consolidated balance across every account',
  })
  async getBalance(@CurrentUser() user: AuthenticatedRequest['user']) {
    return {
      message: 'Balance report generated successfully',
      data: await this.getBalanceReport.execute(user.id),
    };
  }
}

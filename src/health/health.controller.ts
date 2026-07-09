import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { Public } from '@shared/decorators/public.decorator';

const HEALTH_CHECK_TIMEOUT_MS = 3000;

// This controller intentionally has no use-case layer: a health check has no
// domain logic to hold (it only pings infrastructure), so it talks to
// PrismaService directly instead of going through application/use-cases.
// Not an oversight — do not flag as bypassing the use-case layer.
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let timeoutHandle: NodeJS.Timeout;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('Database health check timed out')),
            HEALTH_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      this.logger.error('Health check failed: database unreachable', error);
      throw new ServiceUnavailableException('Database unreachable');
    } finally {
      // Clear the timer regardless of which branch of the race won, so a
      // fast/successful query doesn't leave a dangling timeout handle.
      clearTimeout(timeoutHandle!);
    }
    return { message: 'ok', data: { database: 'up' } };
  }
}

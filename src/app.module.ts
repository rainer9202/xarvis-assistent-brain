import { Module } from '@nestjs/common';
import { PrismaModule } from '@config/database/prisma.module';
import { MovementTypeModule } from '@modules/movement-type/movement-type.module';
import { AccountModule } from '@modules/account/account.module';

@Module({
  imports: [PrismaModule, MovementTypeModule, AccountModule],
})
export class AppModule {}

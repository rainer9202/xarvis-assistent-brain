import { Module } from '@nestjs/common';
import { PrismaModule } from '@config/database/prisma.module';
import { MovementTypeModule } from '@modules/movement-type/movement-type.module';

@Module({
  imports: [PrismaModule, MovementTypeModule],
})
export class AppModule {}

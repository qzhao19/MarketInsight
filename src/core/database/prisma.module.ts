import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * A module that provides the PrismaService for database operations.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
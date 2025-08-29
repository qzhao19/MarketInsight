import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // connect to the database during module initialization
    await this.$connect();
  }

  async onModuleDestroy() {
    // disconnect from the database when the application shuts down
    await this.$disconnect();
  }
}

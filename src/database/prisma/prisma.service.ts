import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { 
  UserNotFoundException, 
  UserAlreadyExistsException, 
  CampaignNotFoundException, 
  TaskNotFoundException, 
  InvalidStatusTransitionException 
} from '../../common/exceptions';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger = new Logger(PrismaService.name);
  
  async onModuleInit() {
    // connect to the database during module initialization
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    // disconnect from the database when the application shuts down
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error('Failed to disconnect from database', error);
    }
  }

  /**
   * Centralized error handler for Prisma operations
   * @param error - The caught error
   * @param context - Description of the operation that failed
   */
  handlePrismaError(error: unknown, context: string): never {
    this.logger.error(`${context}:`, error);

    // Custom exceptions
    if (
      error instanceof UserNotFoundException ||
      error instanceof UserAlreadyExistsException ||
      error instanceof CampaignNotFoundException ||
      error instanceof TaskNotFoundException ||
      error instanceof InvalidStatusTransitionException
    ) {
      this.logger.debug(`Business logic error in ${context}: ${error.message}`);
      throw error;
    } 

    // Prisma errors
    if (error instanceof PrismaClientKnownRequestError) {
      this.logger.warn(`Database constraint error in ${context}`, {
        code: error.code,
        meta: error.meta
      });

      switch (error.code) {
        case 'P2002': // unique constraint conflict
          throw new UserAlreadyExistsException(
            error.meta?.target ? String(error.meta.target) : 'unknown'
          );
        case 'P2025': // record not found: delete/update/find
          if (error.meta?.modelName === 'Task') {
            throw new TaskNotFoundException('unknown');
          }
          if (error.meta?.modelName === 'MarketingCampaign') {
            if (
              typeof context === 'string' &&
              context.includes('create campaign') &&
              context.includes('user')
            ) {
              throw new UserNotFoundException('unknown');
            }
            throw new CampaignNotFoundException('unknown');
          }
          if (error.meta?.modelName === 'User') {
            throw new UserNotFoundException('unknown');
          }
          // default UserNotFoundException
          throw new UserNotFoundException('unknown');
        case 'P2003': // foreign key constraint failure
          if (typeof error.meta?.field_name === 'string' && error.meta.field_name.includes('campaignId')) {
            throw new CampaignNotFoundException('unknown (referenced in task)');
          }
          if (typeof error.meta?.field_name === 'string' && error.meta.field_name.includes('userId')) {
            throw new UserNotFoundException('unknown (referenced in campaign)');
          }
          throw new Error(`Foreign key constraint failed: ${error.message}`);
        default:
          throw new Error(`Database error (${error.code}): ${error.message}`);
      }
    }

    // 3. other error—append context information
    this.logger.error(`Unexpected error in ${context}:`, error);
    throw error instanceof Error ? new Error(`${context}: ${error.message}`) : new Error(`${context}: ${String(error)}`);
  }

  /**
   * Execute operations within a transaction.
   * @param fn - Function to execute inside transaction.
   * @returns Result of the function.
   */
  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn);
  }
}

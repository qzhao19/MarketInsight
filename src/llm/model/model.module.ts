import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModelService } from './model.service';
import { ModelClientService } from './model.client';
import { CircuitBreakerGuard } from './guards/circuit-breaker.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { RequestQueueGuard } from './guards/request-queue.guard';
import { RetryGuard } from './guards/retry.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    ModelService,
    ModelClientService,
    CircuitBreakerGuard,
    RateLimiterGuard,
    RequestQueueGuard,
    RetryGuard,
  ],
  exports: [
    ModelService
  ],
})
export class ModelModule {}
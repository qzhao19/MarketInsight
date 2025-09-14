import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CircuitBreakerGuard } from './guards/circuit-breaker.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { RequestQueueGuard } from './guards/request-queue.guard';
import { RetryGuard } from './guards/retry.guard';
import { ModelClientService } from './client.service';

@Module({
    controllers: [],
    providers: [
        ModelClientService,
        CircuitBreakerGuard,
        RetryGuard,
        {
            provide: RequestQueueGuard,
            useFactory: () => new RequestQueueGuard(5)
        },
        {
            provide: RateLimiterGuard,
            useFactory: () => new RateLimiterGuard(60)
        }

    ],
    exports: [ModelClientService],
	imports: [ConfigModule]
})
export class ModelClientModule {}

import { Module } from "@nestjs/common";
import { CircuitBreakerGuard } from "./guards/circuit-breaker.guard";
import { RateLimiterGuard } from "./guards/rate-limiter.guard";
import { RequestQueueGuard } from "./guards/request-queue.guard";
import { RetryGuard } from "./guards/retry.guard";
import { ModelClientService } from "./client.service";
import { AppConfigModule } from "../../../config/config.module";
import { AppConfigService } from "../../../config/config.service";

@Module({
  imports: [
    // Explicitly import AppConfigModule
    AppConfigModule
  ],
  providers: [
    // ==================== Circuit Breaker Guard ====================
    {
      provide: CircuitBreakerGuard,
      useFactory: (clientConfig: AppConfigService) => {
        return new CircuitBreakerGuard(
          clientConfig.LLMClientConfig.circuitBreakerConfig
        );
      },
      inject: [AppConfigService],
    },

    // ==================== Rate Limiter Guard ====================
    {
      provide: RateLimiterGuard,
      useFactory: (clientConfig: AppConfigService) => {
        return new RateLimiterGuard(
          clientConfig.LLMClientConfig.rateLimiterConfig
        );
      },
      inject: [AppConfigService],
    },

    // ==================== Request Queue Guard ====================
    {
      provide: RequestQueueGuard,
      useFactory: (clientConfig: AppConfigService) => {
        return new RequestQueueGuard(
          clientConfig.LLMClientConfig.requestQueueConfig
        );
      },
      inject: [AppConfigService],
    },

    // ==================== Retry Guard ====================
    {
      provide: RetryGuard,
      useFactory: (clientConfig: AppConfigService) => {
        return new RetryGuard(
          clientConfig.LLMClientConfig.retryConfig
        );
      },
      inject: [AppConfigService],
    },

    // ==================== Model Client Service ====================
    ModelClientService,
  ],
  exports: [
    ModelClientService,
  ],
})
export class ModelClientModule {}
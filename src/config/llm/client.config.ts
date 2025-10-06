import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { ModelClientOptions } from '../../types/llm.types';

/**
 * Client configuration service
 * Provides access to model client protection configurations from .env.service
 */
@Injectable()
export class ClientConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get default circuit breaker reset timeout (ms)
   */
  get defaultCircuitBreakerResetTimeout(): number {
    return this.configService.get<number>(
      'DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT',
      20000
    );
  }

  /**
   * Get default rate limiter max requests per minute
   */
  get defaultRateLimiterMaxRequestsPerMinute(): number {
    return this.configService.get<number>(
      'DEFAULT_RATE_LIMITER_MAX_REQUESTS_PER_MINUTE',
      60
    );
  }

  /**
   * Get default retry max retries
   */
  get defaultRetryMaxRetries(): number {
    return this.configService.get<number>('DEFAULT_RETRY_MAX_RETRIES', 3);
  }

  /**
   * Get default retry initial delay (ms)
   */
  get defaultRetryInitialDelayMs(): number {
    return this.configService.get<number>(
      'DEFAULT_RETRY_INITIAL_DELAY_MS',
      1000
    );
  }

  /**
   * Get default retry max delay (ms)
   */
  get defaultRetryMaxDelayMs(): number {
    return this.configService.get<number>(
      'DEFAULT_RETRY_MAX_DELAY_MS',
      30000
    );
  }

  /**
   * Get default retry factor
   */
  get defaultRetryFactor(): number {
    return this.configService.get<number>('DEFAULT_RETRY_FACTOR', 2);
  }

  /**
   * Get default retry jitter
   */
  get defaultRetryJitter(): boolean {
    return this.configService.get<boolean>('DEFAULT_RETRY_JITTER', true);
  }

  /**
   * Get default retryable errors
   * Note: RegExp patterns cannot be stored in .env, so we define them here
   */
  get defaultRetryableErrors(): RegExp[] {
    return [
      /429/,              // Rate limit error
      /503/,              // Service unavailable
      /timeout/i,         // Timeout error
      /ECONNRESET/,       // Connection reset
      /ETIMEDOUT/,        // Connection timeout
      /ENOTFOUND/,        // DNS lookup failed
      /socket hang up/i,  // Socket errors
    ];
  }

  /**
   * Get complete circuit breaker configuration
   */
  get circuitBreakerConfig() {
    return {
      resetTimeout: this.defaultCircuitBreakerResetTimeout,
    };
  }

  /**
   * Get complete rate limiter configuration
   */
  get rateLimiterConfig() {
    return {
      maxRequestsPerMinute: this.defaultRateLimiterMaxRequestsPerMinute,
    };
  }

  /**
   * Get complete retry configuration
   */
  get retryConfig() {
    return {
      maxRetries: this.defaultRetryMaxRetries,
      initialDelayMs: this.defaultRetryInitialDelayMs,
      maxDelayMs: this.defaultRetryMaxDelayMs,
      factor: this.defaultRetryFactor,
      retryableErrors: this.defaultRetryableErrors,
      jitter: this.defaultRetryJitter,
    };
  }

  /**
   * Get complete default model client options
   */
//   get defaultModelClientOptions(): ModelClientOptions {
//     return {
//       circuitBreakerConfig: this.circuitBreakerConfig,
//       rateLimiterConfig: this.rateLimiterConfig,
//       retryConfig: this.retryConfig,
//     };
//   }
}
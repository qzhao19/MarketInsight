import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CircuitBreakerConfig,
  RateLimiterConfig,
  RequestQueueConfig,
  RetryConfig,
} from '../../types/llm/client.types';

/**
 * Client configuration service
 */
@Injectable()
export class ClientConfigService {
  private readonly logger = new Logger(ClientConfigService.name);

  constructor(private readonly configService: ConfigService) {
    this.validateConfig();
  }

  /**
   * Validate configuration on service initialization
   */
  private validateConfig(): void {
    const configs = {
      circuitBreaker: {
        resetTimeout: this.defaultCircuitBreakerResetTimeout,
        timeout: this.defaultCircuitBreakerTimeout,
        errorThresholdPercentage: this.defaultCircuitBreakerErrorThreshold,
        rollingCountTimeout: this.defaultCircuitBreakerRollingCountTimeout,
        volumeThreshold: this.defaultCircuitBreakerVolumeThreshold,
        capacity: this.defaultCircuitBreakerCapacity,
      },
      rateLimiter: {
        maxRequestsPerMinute: this.defaultRateLimiterMaxRequestsPerMinute,
      },
      requestQueue: {
        maxConcurrent: this.defaultRequestQueueMaxConcurrent,
      },
      retry: {
        maxRetries: this.defaultRetryMaxRetries,
        initialDelayMs: this.defaultRetryInitialDelayMs,
        maxDelayMs: this.defaultRetryMaxDelayMs,
        factor: this.defaultRetryFactor,
        jitter: this.defaultRetryJitter,
      },
    };

    if (configs.circuitBreaker.resetTimeout <= 0) {
      this.logger.warn(
        `Invalid DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT: ${configs.circuitBreaker.resetTimeout}. Using default: 20000`
      );
    }

    if (configs.rateLimiter.maxRequestsPerMinute <= 0) {
      this.logger.warn(
        `Invalid DEFAULT_RATE_LIMITER_MAX_REQUESTS_PER_MINUTE: ${configs.rateLimiter.maxRequestsPerMinute}. Using default: 60`
      );
    }

    if (configs.requestQueue.maxConcurrent <= 0) {
      this.logger.warn(
        `Invalid DEFAULT_REQUEST_QUEUE_MAX_CONCURRENT: ${configs.requestQueue.maxConcurrent}. Using default: 5`
      );
    }

    if (configs.retry.initialDelayMs > configs.retry.maxDelayMs) {
      this.logger.warn(
        `initialDelayMs (${configs.retry.initialDelayMs}) > maxDelayMs (${configs.retry.maxDelayMs}). This may cause issues.`
      );
    }

    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(
        `ClientConfig loaded:\n${JSON.stringify(configs, null, 2)}`
      );
    }
  }

  /**
   * Safely get number from config with validation
   */
  private getNumber(key: string, defaultValue: number, min?: number, max?: number): number {
    const value = this.configService.get<number>(key, defaultValue);
    
    // Check if number is valid
    if (isNaN(value) || !isFinite(value)) {
      this.logger.warn(
        `Invalid number for ${key}: ${value}. Using default: ${defaultValue}`
      );
      return defaultValue;
    }

    // Check range
    if (min !== undefined && value < min) {
      this.logger.warn(
        `${key} value ${value} is below minimum ${min}. Using minimum.`
      );
      return min;
    }

    if (max !== undefined && value > max) {
      this.logger.warn(
        `${key} value ${value} is above maximum ${max}. Using maximum.`
      );
      return max;
    }

    return value;
  }

  /**
   * Safely get boolean from config
   */
  private getBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string>(key);
    
    if (value === undefined || value === null) {
      return defaultValue;
    }

    // Check string "true" / "false"
    const lowerValue = String(value).toLowerCase().trim();
    
    if (lowerValue === 'true' || lowerValue === '1') {
      return true;
    }
    
    if (lowerValue === 'false' || lowerValue === '0') {
      return false;
    }

    this.logger.warn(
      `Invalid boolean for ${key}: ${value}. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  // ==================== Circuit Breaker ====================

  /**
   * Get default circuit breaker reset timeout (ms)
   * Valid range: 1000 - 300000 (1 second - 5 minutes)
   */
  get defaultCircuitBreakerResetTimeout(): number {
    return this.getNumber(
      'DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT',
      20000,
      1000,
      300000
    );
  }

  /**
   * Get circuit breaker timeout (ms)
   * Valid range: 1000 - 300000 (1 second - 5 minutes)
   */
  get defaultCircuitBreakerTimeout(): number {
    return this.getNumber(
      'DEFAULT_CIRCUIT_BREAKER_TIMEOUT',
      30000,
      1000,
      300000
    );
  }

  /**
   * Get circuit breaker error threshold percentage
   * Valid range: 1 - 100
   */
  get defaultCircuitBreakerErrorThreshold(): number {
    return this.getNumber(
      'DEFAULT_CIRCUIT_BREAKER_ERROR_THRESHOLD',
      50,
      1,
      100
    );
  }

  /**
   * Get circuit breaker rolling count timeout (ms)
   * Valid range: 1000 - 60000 (1 second - 1 minute)
   */
  get defaultCircuitBreakerRollingCountTimeout(): number {
    return this.getNumber(
      'DEFAULT_CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT',
      10000,
      1000,
      60000
    );
  }

  /**
   * Get circuit breaker volume threshold
   * Minimum number of requests before circuit can open
   * Valid range: 1 - 1000
   */
  get defaultCircuitBreakerVolumeThreshold(): number {
    return this.getNumber(
      'DEFAULT_CIRCUIT_BREAKER_VOLUME_THRESHOLD',
      10,
      1,
      1000
    );
  }

  /**
   * Get circuit breaker capacity
   * Maximum number of concurrent requests
   * Valid range: 1 - 10000
   */
  get defaultCircuitBreakerCapacity(): number {
    return this.getNumber(
      'DEFAULT_CIRCUIT_BREAKER_CAPACITY',
      100,
      1,
      10000
    );
  }

  /**
   * Get circuit breaker name (optional)
   */
  get defaultCircuitBreakerName(): string | undefined {
    return this.configService.get<string>('DEFAULT_CIRCUIT_BREAKER_NAME');
  }

  // ==================== Rate Limiter ====================

  /**
   * Get default rate limiter max requests per minute
   * Valid range: 1 - 10000
   */
  get defaultRateLimiterMaxRequestsPerMinute(): number {
    return this.getNumber(
      'DEFAULT_RATE_LIMITER_MAX_REQUESTS_PER_MINUTE',
      60,
      1,
      10000
    );
  }

  // ==================== Request Queue ====================

  /**
   * Get default request queue max concurrent requests
   * Valid range: 1 - 1000
   */
  get defaultRequestQueueMaxConcurrent(): number {
    return this.getNumber(
      'DEFAULT_REQUEST_QUEUE_MAX_CONCURRENT',
      5,
      1,
      1000
    );
  }

  // ==================== Retry ====================

  /**
   * Get default retry max retries
   * Valid range: 0 - 10
   */
  get defaultRetryMaxRetries(): number {
    return this.getNumber('DEFAULT_RETRY_MAX_RETRIES', 3, 0, 10);
  }

  /**
   * Get default retry initial delay (ms)
   * Valid range: 100 - 60000
   */
  get defaultRetryInitialDelayMs(): number {
    return this.getNumber('DEFAULT_RETRY_INITIAL_DELAY_MS', 1000, 100, 60000);
  }

  /**
   * Get default retry max delay (ms)
   * Valid range: 1000 - 300000
   */
  get defaultRetryMaxDelayMs(): number {
    return this.getNumber('DEFAULT_RETRY_MAX_DELAY_MS', 30000, 1000, 300000);
  }

  /**
   * Get default retry factor
   * Valid range: 1.1 - 10
   */
  get defaultRetryFactor(): number {
    return this.getNumber('DEFAULT_RETRY_FACTOR', 2, 1.1, 10);
  }

  /**
   * Get default retry jitter
   */
  get defaultRetryJitter(): boolean {
    return this.getBoolean('DEFAULT_RETRY_JITTER', true);
  }

  /**
   * Get default retryable errors
   * Note: RegExp patterns cannot be stored in .env, so we define them here
   */
  get defaultRetryableErrors(): RegExp[] {
    const customErrorCodes = this.configService.get<string>('RETRYABLE_ERROR_CODES', '');
    const customPatterns = customErrorCodes
      .split(',')
      .filter(code => code.trim())
      .map(code => new RegExp(code.trim(), 'i'));

    return [
      ...customPatterns,
      /429/,              // Rate limit error
      /503/,              // Service unavailable
      /timeout/i,         // Timeout error
      /ECONNRESET/,       // Connection reset
      /ETIMEDOUT/,        // Connection timeout
      /ENOTFOUND/,        // DNS lookup failed
    ];
  }

  // ==================== Composite Configurations ====================

  /**
   * Get complete circuit breaker configuration
   */
  get circuitBreakerConfig(): CircuitBreakerConfig {
    return {
      resetTimeout: this.defaultCircuitBreakerResetTimeout,
      timeout: this.defaultCircuitBreakerTimeout,
      errorThresholdPercentage: this.defaultCircuitBreakerErrorThreshold,
      rollingCountTimeout: this.defaultCircuitBreakerRollingCountTimeout,
      volumeThreshold: this.defaultCircuitBreakerVolumeThreshold,
      capacity: this.defaultCircuitBreakerCapacity,
      name: this.defaultCircuitBreakerName,
    };
  }

  /**
   * Get complete rate limiter configuration
   */
  get rateLimiterConfig(): RateLimiterConfig {
    return {
      maxRequestsPerMinute: this.defaultRateLimiterMaxRequestsPerMinute,
    };
  }

  /**
   * Get complete request queue configuration
   */
  get requestQueueConfig(): RequestQueueConfig {
    return {
      maxConcurrent: this.defaultRequestQueueMaxConcurrent,
    };
  }

  /**
   * Get complete retry configuration
   */
  get retryConfig(): RetryConfig {
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
   * Get all guard configurations as a single object
   */
  get allGuardConfigs() {
    return {
      circuitBreaker: this.circuitBreakerConfig,
      rateLimiter: this.rateLimiterConfig,
      requestQueue: this.requestQueueConfig,
      retry: this.retryConfig,
    };
  }
}
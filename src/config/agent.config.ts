import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Agent configuration service
 * Provides centralized access to agent-related configuration values
 */
@Injectable()
export class AgentConfigService {
  constructor(private readonly configService: ConfigService) {
    this.validateConfig();
  }

  /**
   * Validate required configuration
   */
  private validateConfig(): void {
    const required = [
      'DEEPSEEK_API_KEY',
      'DEEPSEEK_BASE_URL',
      'SERPER_API_KEY',
    ];
    
    const missing = required.filter(key => !this.configService.get(key));
    
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Get default model name
   */
  get defaultModelName(): string {
    return this.configService.get<string>(
      'DEFAULT_MODEL_NAME',
      'deepseek-chat'
    );
  }

  /**
   * Get default model temperature
   */
  get defaultModelTemperature(): number {
    return this.configService.get<number>('DEFAULT_MODEL_TEMPERATURE', 0);
  }

  /**
   * Get default workflow timeout (ms)
   */
  get defaultWorkflowTimeout(): number {
    return this.configService.get<number>(
      'DEFAULT_WORKFLOW_TIMEOUT',
      600000 // 10 minutes
    );
  }

  /**
   * Get default recursion limit
   */
  get defaultRecursionLimit(): number {
    return this.configService.get<number>('DEFAULT_RECURSION_LIMIT', 50);
  }

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
      /429/,        // rate limit error
      /503/,        // service unavailable
      /timeout/,    // timeout error
      /ECONNRESET/, // connection reset
      /ETIMEDOUT/   // connection timeout
    ];
  }

  /**
   * Get complete default circuit breaker configuration
   */
  get defaultCircuitBreakerConfig() {
    return {
      resetTimeout: this.defaultCircuitBreakerResetTimeout,
    };
  }

  get defaultRateLimiterConfig() {
    return {
      maxRequestsPerMinute: this.defaultRateLimiterMaxRequestsPerMinute,
    };
  }

  /**
   * Get complete default retry configuration
   */
  get defaultRetryConfig() {
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
   * Get API keys
   */
  get deepseekApiKey(): string {
    return this.configService.get<string>('DEEPSEEK_API_KEY', '');
  }

  get deepseekBaseUrl(): string {
    return this.configService.get<string>('DEEPSEEK_BASE_URL', '');
  }

  get serperApiKey(): string {
    return this.configService.get<string>('SERPER_API_KEY', '');
  }
}
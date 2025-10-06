import { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Configuration for circuit breaker 
 */
export interface CircuitBreakerConfig {
  resetTimeout: number, 
  timeout: number,
  errorThresholdPercentage: number,
  rollingCountTimeout: number,
}

/**
 * Configuration for rate limiter
 */
export interface RateLimiterConfig {
  maxRequestsPerMinute: number;
}

/**
 * Configuration for request queue
 */
export interface RequestQueueConfig {
  maxConcurrent: number;
}

/**
 * Configuration for retry
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  retryableErrors: RegExp[];
  jitter: boolean;
}

/**
 * Model client configuration options
 * Defines protection mechanisms: circuit breaker, rate limiter, retry logic
 */
export interface ModelClientOptions {
  // model instance
  model: BaseChatModel;

  // configs for circuit breaker guard
  circuitBreakerConfig: {
    resetTimeout: number;
  };

  // configs for rate limiter guard
  rateLimiterConfig: {
    maxRequestsPerMinute: number;
  };

  // retry config
  retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    factor: number;
    retryableErrors: RegExp[];
    jitter: boolean;
  };
};
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk } from '@langchain/core/messages';
import { ChatOpenAICallOptions } from '@langchain/openai';
import { HttpException, HttpStatus, Logger, Injectable } from '@nestjs/common';

import { CircuitBreakerGuard } from './guards/circuit-breaker.guard';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { RequestQueueGuard } from './guards/request-queue.guard';
import { RetryGuard } from './guards/retry.guard';

interface ModelClientOptions {
  // model instance
  model: BaseChatModel;

  // configs for circuit breaker guard
  CircuitBreakerConfig: {
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

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export class ModelClient {
  private readonly model: BaseChatModel;
  private readonly circuitBreakerConfig: { resetTimeout: number; };
  private readonly rateLimiterConfig: { maxRequestsPerMinute: number; };
  private readonly retryConfig: Required<ModelClientOptions['retryConfig']>;
  private readonly logger: Logger;

  constructor(
    config: DeepPartial<ModelClientOptions>,
    private readonly circuitBreaker: CircuitBreakerGuard,
    private readonly rateLimiter: RateLimiterGuard,
    private readonly requestQueue: RequestQueueGuard,
    private readonly retry: RetryGuard,
    logger?: Logger,
  ) {
    this.logger = logger || new Logger(ModelClient.name);

    if (!config.model) {
      const msg = 'ModelClient requires a "model" instance in its configuration.';
      this.logger.error(msg);
      throw new Error(msg);
    }
    this.model = config.model as BaseChatModel;

    // defaults configs
    this.circuitBreakerConfig = {
      resetTimeout: 30000,
      ...config.CircuitBreakerConfig,
    };

    this.rateLimiterConfig = {
      maxRequestsPerMinute: 60,
      ...config.rateLimiterConfig,
    };

    this.retryConfig = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      factor: 2,
      jitter: true,
      ...config.retryConfig,
      retryableErrors: (config.retryConfig?.retryableErrors ?? []).filter((x): x is RegExp => x instanceof RegExp),
    };
  }

  public async invoke(
    input: BaseLanguageModelInput, 
    options?: ChatOpenAICallOptions
  ): Promise<AIMessageChunk> {

    // setup circuit breaker protection, pass fallback function during creation
    const breaker = this.circuitBreaker.getOrCreateBreaker(
      `${(this.model as any)?.model ?? 'Unknown-model-name'}`,
      async (currentInput: BaseLanguageModelInput) => this.model.invoke(currentInput, options),
      {
        resetTimeout: this.circuitBreakerConfig.resetTimeout,
      },
      () => {
        const msg = `${(this.model as any)?.model} service is temporarily unavailable`;
        this.logger.error(msg);
        throw new HttpException(msg, HttpStatus.SERVICE_UNAVAILABLE);
      },
    );

    // setup rate limit control, await the acquire promise
    await this.rateLimiter.acquire();

    // push request to queue
    return this.requestQueue.enqueue(async () => {
      return this.retry.exponentialBackoff(
        () => breaker.fire(input) as Promise<AIMessageChunk>,
        this.retryConfig,
      );
    });
  }
};

@Injectable()
export class ModelClientService {
  constructor(
    private circuitBreaker: CircuitBreakerGuard,
    private rateLimiter: RateLimiterGuard,
    private requestQueue: RequestQueueGuard,
    private retry: RetryGuard,
  ) {};

  public createClient(config: DeepPartial<ModelClientOptions>) {
    return new ModelClient(
      config,
      this.circuitBreaker,
      this.rateLimiter,
      this.requestQueue,
      this.retry,
    );
  }
}


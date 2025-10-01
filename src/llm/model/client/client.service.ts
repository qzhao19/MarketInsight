import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StructuredOutputMethodOptions } from "@langchain/core/language_models/base";

import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAICallOptions } from "@langchain/openai";
import { HttpException, HttpStatus, Logger, Injectable } from "@nestjs/common";
import { z } from "zod";

import { ChatOpenAIToolType } from "../../../types/llm.types"
import { CircuitBreakerGuard } from "./guards/circuit-breaker.guard";
import { RateLimiterGuard } from "./guards/rate-limiter.guard";
import { RequestQueueGuard } from "./guards/request-queue.guard";
import { RetryGuard } from "./guards/retry.guard";

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
  private readonly retryConfig: Required<ModelClientOptions["retryConfig"]>;
  private readonly logger: Logger;
  private readonly originalConfig: DeepPartial<ModelClientOptions>;
  
  constructor(
    config: DeepPartial<ModelClientOptions>,
    private readonly circuitBreaker: CircuitBreakerGuard,
    private readonly rateLimiter: RateLimiterGuard,
    private readonly requestQueue: RequestQueueGuard,
    private readonly retry: RetryGuard,
  ) {
    this.logger = new Logger(ModelClient.name);
    this.originalConfig = config;

    if (!config.model) {
      const msg = "ModelClient requires a 'model' instance in its configuration.";
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
      retryableErrors: (
        config.retryConfig?.retryableErrors ?? []
      ).filter((x): x is RegExp => x instanceof RegExp),
    };
  }

  public bindTools(
    tools: ChatOpenAIToolType[], 
    options?: ChatOpenAICallOptions
  ): ModelClient {

    try {
      if (!this.model || typeof (this.model as any).bindTools !== 'function') {
        const errorMsg = `Model does not support bindTools method: ${(this.model as any)?.model || 'unknown'}`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Use type assertion to safely call bindTools
      const modelWithTools = (this.model as any).bindTools(tools, options);

      // Create a new config with the tools-enabled model
      const newConfig: DeepPartial<ModelClientOptions> = {
        ...this.originalConfig,
        model: modelWithTools,
      };

      return new ModelClient(
        newConfig,
        this.circuitBreaker,
        this.rateLimiter,
        this.requestQueue,
        this.retry
      );

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to bind tools to model: ${errorMsg}`);
      throw new Error(`Failed to bind tools to model: ${errorMsg}`);
    }
  }

  public withStructuredOutput<T extends z.ZodObject<any>>(
    schema: T,
    options?: StructuredOutputMethodOptions
  ): ModelClient {

    try {
      // Create the new structured model from the current model
      const structuredModel = this.model.withStructuredOutput(schema, options);

      const newConfig: DeepPartial<ModelClientOptions> = {
        ...this.originalConfig,
        model: structuredModel,
      };

      return new ModelClient(
        newConfig,
        this.circuitBreaker,
        this.rateLimiter,
        this.requestQueue,
        this.retry
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to use withStructuredOutput to model: ${errorMsg}`);
      throw new Error(`Failed to use withStructuredOutput to model: ${errorMsg}`);
    }
  }

  public async invoke(
    input: BaseLanguageModelInput, 
    options?: ChatOpenAICallOptions
  ): Promise<AIMessageChunk> {

    // Get model name
    const modelName = ((this.model as any)?.model || 
                     (this.model as any)?.modelName || 
                     "model").toString();
    
    // setup circuit breaker protection, pass fallback function during creation
    const breaker = this.circuitBreaker.getOrCreateBreaker(
      modelName,
      async (
        currentInput: BaseLanguageModelInput, 
        currentOptions?: ChatOpenAICallOptions
      ) => this.model.invoke(currentInput, currentOptions),
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
        // Pass input and options to breaker.fire
        () => breaker.fire(input, options) as Promise<AIMessageChunk>,
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


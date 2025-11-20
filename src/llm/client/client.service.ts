import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAICallOptions } from "@langchain/openai";
import { 
  BaseLanguageModelInput, 
  StructuredOutputMethodOptions 
} from "@langchain/core/language_models/base";
import { HttpException, HttpStatus, Logger, Injectable } from "@nestjs/common";
import { z } from "zod";

import { ChatOpenAIToolType, LLMChatModelType } from "../../types/llm/client.types"
import { CircuitBreakerGuard } from "../../common/guards/llm/circuit-breaker.guard";
import { RateLimiterGuard } from "../../common/guards/llm/rate-limiter.guard";
import { RequestQueueGuard } from "../../common/guards/llm/request-queue.guard";
import { RetryGuard } from "../../common/guards/llm/retry.guard";

export class LLModelClient {
  private readonly model: LLMChatModelType;
  private readonly logger: Logger;
  private readonly instanceId: string;
  private readonly originalModelName: string;

  constructor(
    model: LLMChatModelType, 
    private readonly circuitBreaker: CircuitBreakerGuard,
    private readonly rateLimiter: RateLimiterGuard,
    private readonly requestQueue: RequestQueueGuard,
    private readonly retry: RetryGuard,
    modelName?: string,
  ) {
    this.logger = new Logger(LLModelClient.name);
    this.model = model
    this.instanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!this.model) {
      const errorMsg = "LLModelClient requires a 'model' instance in its configuration.";
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Use default modelName
    this.originalModelName = (
      modelName || 
      (this.model as any)?.model ||
      (this.model as any)?.modelName ||
      (this.model as any)?.name ||
      "unknown-model"
    ).toString();
    this.logger.debug(`LLModelClient created with model: ${this.originalModelName}`);

  }

  private getModelName(): string {
    return this.originalModelName;
  }

  public getUnderlyingModel(): LLMChatModelType {
    return this.model;
  }

  public bindTools(
    tools: ChatOpenAIToolType[], 
    options?: ChatOpenAICallOptions
  ): LLModelClient {

    try {
      // Check if model supports bindTools
      if (!this.model || typeof (this.model as any).bindTools !== "function") {
        const errorMsg = `Model does not support bindTools method: ${this.getModelName()}`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Use type assertion to safely call bindTools
      const modelWithTools = (this.model as any).bindTools(tools, options);

      // Use new model to create client service
      return new LLModelClient(
        modelWithTools,
        this.circuitBreaker,
        this.rateLimiter,
        this.requestQueue,
        this.retry,
        this.originalModelName,
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
  ): LLModelClient {

    try {
      // Check if model supports withStructuredOutput
      if (!this.model || typeof (this.model as any).withStructuredOutput !== "function") {
        const errorMsg = `Model does not support withStructuredOutput method: ${this.getModelName()}`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Create the new structured model from the current model
      const structuredModel = (this.model as any).withStructuredOutput(schema, options);

      return new LLModelClient(
        structuredModel,
        this.circuitBreaker,
        this.rateLimiter,
        this.requestQueue,
        this.retry,
        this.originalModelName,
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
    const baseModelName = this.getModelName();
    const uniqueBreakerName = `${baseModelName}-${this.instanceId}`;
    this.logger.debug(`Invoking model ${uniqueBreakerName} with input type: ${typeof input}`);

    // Create a invoke wrapper
    const invokeWrapper = async (
      currentInput: BaseLanguageModelInput, 
      currentOptions?: ChatOpenAICallOptions
    ) => {
      if (typeof (this.model as any).invoke === "function") {
        return (this.model as any).invoke(currentInput, currentOptions);
      } else {
        throw new Error(
          `Model ${baseModelName} does not support invoke method`
        );
      }
    };

    // setup circuit breaker protection, pass fallback function during creation
    const breaker = this.circuitBreaker.getOrCreateBreaker(
      uniqueBreakerName,
      invokeWrapper,
      () => {
        // const errorMsg = error instanceof Error ? error.message : String(error);
        const msg = `Model service "${baseModelName}" (${uniqueBreakerName}) is temporarily unavailable.`;
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
      );
    });
  }
};

@Injectable()
export class LLModelClientService {
  constructor(
    private circuitBreaker: CircuitBreakerGuard,
    private rateLimiter: RateLimiterGuard,
    private requestQueue: RequestQueueGuard,
    private retry: RetryGuard,
  ) {};

  public createClient(model: LLMChatModelType, modelName?: string) {
    if (!model) {
      throw new Error("LLModelClient requires a valid model instance");
    }

    return new LLModelClient(
      model,
      this.circuitBreaker,
      this.rateLimiter,
      this.requestQueue,
      this.retry,
      modelName,
    );
  }
}


import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAIFields } from "@langchain/openai";
import { ModelClient, ModelClientService } from "./client/client.service";

/**
 * Generate a unique key for caching model configurations
 */
function generateModelKey(config: ChatOpenAIFields): string {
  // extract keys instead of entire object
  const { model, temperature, topP } = config;
  return `${model || "default"}-${temperature || 0}-${topP || 1}`;
}

/**
 * Merge model configs
 */
function mergeModelConfig<T extends { configuration?: unknown }>(
  config: T
): Omit<T, "configuration"> & Record<string, unknown> {
  const { configuration, ...baseConfig } = config;
  return {
    ...baseConfig,
    ...(configuration || {})
  };
}

@Injectable()
export class ModelService implements OnModuleInit {
  private readonly logger: Logger;
  private models: Map<string, ModelClient> = new Map();
  private rawModels: Map<string, ChatDeepSeek> = new Map();

  // lazily initialized configs
  private _deepseekConfig: ChatOpenAIFields | null = null;

  // default client options
  readonly defaultModelClientOptions = {
    circuitBreakerConfig: {
      resetTimeout: 20000,
    },
    rateLimiterConfig: {
      maxRequestsPerMinute: 60
    },
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      factor: 2,
      retryableErrors: [
        /429/,        // rate limit error
        /503/,        // service unavailable
        /timeout/,    // timeout error
        /ECONNRESET/, // connection reset
        /ETIMEDOUT/   // connection timeout
      ],
      jitter: true,
    }
  };

  constructor(
    @Inject(forwardRef(() => ModelClientService))
    private readonly modelClientService: ModelClientService,
    private readonly configService: ConfigService,
  ) {
    this.logger = new Logger(ModelService.name);
  }

  onModuleInit() {
    this.logger.debug("ModelService constructor called");
    this.logger.debug(`ConfigService injected: ${!!this.configService}`);
    this.logger.debug(`ModelClientService injected: ${!!this.modelClientService}`);
    
    if (!this.modelClientService) {
      this.logger.error("ModelClientService not injected properly!");
      throw new Error("ModelClientService not injected");
    }

    if (!this.configService) {
      this.logger.error("ConfigService not injected properly!");
      throw new Error("ConfigService not injected");
    }

    this.initializeDefaultModels();
  }

  get deepseekConfig(): ChatOpenAIFields {
    if (!this._deepseekConfig) {
      const apiKey = this.configService.get<string>("DEEPSEEK_API_KEY");
      const baseURL = this.configService.get<string>("DEEPSEEK_BASE_URL");

      if (!apiKey) {
        this.logger.warn("DEEPSEEK API key not found in environment variables!");
      } 
      
      this._deepseekConfig = {
        model: "deepseek-reasoner",
        configuration: {
          apiKey,
          timeout: 600000,
          baseURL,
          maxRetries: 3
        }
      };
    }
    return this._deepseekConfig;
  }

  /**
   * Initialize default models
   */
  private initializeDefaultModels(): void {
    try {
      // create raw model
      const mergedConfig = mergeModelConfig(this.deepseekConfig);
      const rawModel = new ChatDeepSeek(mergedConfig);
      
      // cache raw model
      const configKey = generateModelKey(this.deepseekConfig);
      this.rawModels.set(configKey, rawModel);
      
      // create and cache guarded model
      const guardedModel = this.modelClientService.createClient({
        model: rawModel,
        ...this.defaultModelClientOptions
      });
      this.models.set(configKey, guardedModel);
      
      this.logger.log(
        `Default DeepSeek model initialized: ${this.deepseekConfig.model}`
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to initialize default models: ${error.message}`, error.stack
        );
      } else {
        this.logger.error(
          `Failed to initialize default models: ${JSON.stringify(error)}`
        );
      }
    }
  }

  /**
   * Get DeepSeek model with protection mechanisms
   * @param baseConfig Base configuration (defaults to service default configuration)
   * @param clientOptions Client option overrides
   * @returns Guarded model client
   */
  public async getDeepSeekGuardModel(
    baseModelConfig: Partial<ChatOpenAIFields> = {},
    clientOptions: Record<string, unknown> = {}
  ): Promise<ModelClient | undefined> {
    try {
      // create a copy of the config
      const ModelConfig: ChatOpenAIFields = {
        ...this.deepseekConfig, 
        ...baseModelConfig 
      };
      const configKey = generateModelKey(ModelConfig);
      
      if (this.models.has(configKey)) {
        return this.models.get(configKey);
      }
      
      // merge config and create new model
      const mergedModelConfig = mergeModelConfig(ModelConfig);
      const rawModel = new ChatDeepSeek(mergedModelConfig);
      
      const newModel = this.modelClientService.createClient({
        model: rawModel,
        ...this.defaultModelClientOptions,
        ...clientOptions
      });
      
      // cache
      this.models.set(configKey, newModel);
      return newModel;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error creating guarded model: ${error.message}`, error.stack);
      } else {
        this.logger.error(`Error creating guarded model: ${JSON.stringify(error)}`);
      }
      return undefined;
    }
  }

  /**
   * Get raw DeepSeek model (without protection)
   * @param modelNameOrConfig Model name or full configuration
   * @returns ChatDeepSeek instance
   */
  public getDeepSeekRawModel(modelNameOrConfig?: string | ChatOpenAIFields): ChatDeepSeek | undefined {
    try {
      let config: ChatOpenAIFields;
      
      // handle different types of input parameters
      if (typeof modelNameOrConfig === "string" && 
          (modelNameOrConfig === "deepseek-reasoner" || modelNameOrConfig === "deepseek-chat")) {
        // if it's a model name，create a new config object based on the default configs
        config = { 
          ...this.deepseekConfig,
          model: modelNameOrConfig 
        };
      } else if (modelNameOrConfig === undefined) {
        // use default configs
        config = { ...this.deepseekConfig };
      } else if (typeof modelNameOrConfig === "object") {
        // use given configs
        config = { ...modelNameOrConfig };
      } else {
        throw new Error(`Invalid model configuration: ${modelNameOrConfig}`);
      }
      
      const configKey = generateModelKey(config);
      
      if (this.rawModels.has(configKey)) {
        return this.rawModels.get(configKey);
      }
      
      // create model
      const mergedConfig = mergeModelConfig(config);
      const newModel = new ChatDeepSeek(mergedConfig);
      this.rawModels.set(configKey, newModel);
      return newModel;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error creating raw model: ${error.message}`, error.stack);
      } else {
        this.logger.error(`Error creating raw model: ${JSON.stringify(error)}`);
      }
      return undefined;
    }
  }
}
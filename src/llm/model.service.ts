import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAIFields } from "@langchain/openai";

import { LLModelClient, LLModelClientService } from "./client/client.service";
import { AppConfigService } from "../config/config.service";
import { LLMModelConfig } from "../types/llm/model.types";
import { toOpenAIConfig } from "../utils/llm.utils"

/**
 * Generate a unique key for caching model configurations
 */
function generateModelKey(config: ChatOpenAIFields): string {
  // extract keys instead of entire object
  const { model, temperature, topP } = config;
  return `${model || "default"}-${temperature || 0}-${topP || 1}`;
}

@Injectable()
export class LLModelService implements OnModuleInit {
  private readonly logger: Logger;
  private models: Map<string, LLModelClient> = new Map();
  private rawModels: Map<string, ChatDeepSeek> = new Map();

  // API credentials (not stored in .env.llm for security)
  private apiKey: string;
  private baseURL: string;

  constructor(
    @Inject(forwardRef(() => LLModelClientService))
    private readonly modelClientService: LLModelClientService,
    private readonly configService: AppConfigService,
  ) {
    this.logger = new Logger(LLModelService.name);

    // Fetch API credentials from environment variables
    this.apiKey = this.configService.llmApiKey;
    this.baseURL = this.configService.llmBaseURL;

    if (!this.apiKey) {
      this.logger.warn("LLM API key not found in environment variables!");
    }
  }

  onModuleInit() {
    this.logger.debug("LLModelService initializing...");
    this.logger.debug(`ConfigService injected: ${!!this.configService}`);
    
    if (!this.modelClientService) {
      this.logger.error("LLModelClientService not injected properly!");
      throw new Error("LLModelClientService not injected");
    }

    if (!this.configService) {
      this.logger.error("ConfigService not injected properly!");
      throw new Error("ConfigService not injected");
    }

    this.initializeDefaultModels();
    this.logger.log("LLModelService initialized successfully");
  }

  /**
   * Get the default DeepSeek model configuration
   * Combines model parameters from ModelConfigService with API credentials
   */
  private getDefaultDeepSeekConfig(): ChatOpenAIFields {
    // Get default model configuration from ModelConfigService
    const defaultConfig = this.configService.LLMModelConfig.defaultModelConfig;

    // Create basic config: 
    const modelConfig: ChatOpenAIFields = {
      ...defaultConfig,
      apiKey: this.apiKey,
      // Add client connection-related configuration
      configuration: {
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      }
    };

    // Valid configs
    const validation = this.configService.LLMModelConfig.validateModelConfig(modelConfig);
    if (!validation.isValid) {
      this.logger.warn(`Invalid model configuration: ${validation.errors.join(", ")}`);
    }

    return modelConfig;
  }

  /**
   * Initialize default models
   */
  private initializeDefaultModels(): void {
    try {
      // Get default model configuration from ModelConfigService
      const defaultConfig = this.getDefaultDeepSeekConfig();
      
      const rawModel = new ChatDeepSeek(defaultConfig);
      
      // Cache raw model
      const configKey = generateModelKey(defaultConfig);
      this.rawModels.set(configKey, rawModel);
      
      // Create and cache guarded model
      const guardedModel = this.modelClientService.createClient(rawModel);
      this.models.set(configKey, guardedModel);

      this.logger.log(
        `Default LLM model initialized: ${defaultConfig.model}`
      );

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to initialize default models: ${errorMsg}`
      );
    }
  }

  /**
   * Get DeepSeek model with protection mechanisms
   * @param modelConfigOverrides Override default model configuration (optional)
   * @returns Guarded model client
   */
  public async getDeepSeekGuardModel(
    modelConfigOverrides: Partial<LLMModelConfig>
  ): Promise<LLModelClient | undefined> {
    try {
      // Start with default config from config service
      const defaultConfig = this.getDefaultDeepSeekConfig();

      // Convert modelConfigOverrides to ChatOpenAIFields format if provided
      const convertedOverrides = modelConfigOverrides && Object.keys(modelConfigOverrides).length > 0 
        ? toOpenAIConfig(modelConfigOverrides as LLMModelConfig)
        : {};

      // Create a merged config with overrides
      // BUT keep configuration object intact with API credentials
      const modelConfig: ChatOpenAIFields = {
        ...defaultConfig,           // Default model parameters
        ...convertedOverrides,      // User overrides (model, temperature, topP, etc.)
        apiKey: this.apiKey,
        configuration: {
          apiKey: this.apiKey,      // Use the service's API key
          baseURL: this.baseURL,    // Use the service's base URL
        }
      };

      // Validate the merged configuration
      const validation = this.configService.LLMModelConfig.validateModelConfig(modelConfig);
      if (!validation.isValid) {
        this.logger.warn(`Invalid model configuration: ${validation.errors.join(", ")}`);
      }

      // Create model key
      const configKey = generateModelKey(modelConfig);
      if (this.models.has(configKey)) {
        return this.models.get(configKey);
      }

      const rawModel = new ChatDeepSeek(modelConfig);
      const newModel = this.modelClientService.createClient(rawModel);
      
      // Cache
      this.models.set(configKey, newModel);
      return newModel;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error creating guarded model: ${errorMsg}`
      );
      return undefined;
    }
  }

  /**
   * Get raw DeepSeek model (without protection)
   * @param modelNameOrConfig Model name or full configuration
   * @returns ChatDeepSeek instance
   */
  public async getDeepSeekRawModel(
    modelNameOrConfig?: string | Partial<LLMModelConfig>
  ): Promise<ChatDeepSeek | undefined> {
    try {
      // Get default config from config service
      const defaultConfig = this.getDefaultDeepSeekConfig();
      let modelConfig: ChatOpenAIFields;
      
      // Handle different types of input parameters
      if (typeof modelNameOrConfig === "string") {
        // If it"s a model name, create a config with that model name
        modelConfig = { 
          ...defaultConfig,
          model: modelNameOrConfig,
          apiKey: this.apiKey,
          configuration: {
            apiKey: this.apiKey,
            baseURL: this.baseURL,
          }
        };
      } else if (modelNameOrConfig === undefined) {
        // Use default config
        modelConfig = defaultConfig;
      } else if (typeof modelNameOrConfig === "object") {
        const convertedOverrides = toOpenAIConfig(modelNameOrConfig as LLMModelConfig);
        modelConfig = { 
          ...defaultConfig,
          ...convertedOverrides,
          apiKey: this.apiKey,
          configuration: {
            apiKey: this.apiKey,
            baseURL: this.baseURL,
          }
        };
      } else {
        throw new Error(`Invalid model configuration: ${modelNameOrConfig}`);
      }
      
      const configKey = generateModelKey(modelConfig);
      if (this.rawModels.has(configKey)) {
        return this.rawModels.get(configKey);
      }

      const newModel = new ChatDeepSeek(modelConfig);
      this.rawModels.set(configKey, newModel);
      return newModel;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error creating raw model: ${errorMsg}`
      );
      return undefined;
    }
  }

  /**
   * Get current model configuration stats
   * @returns Current default model configuration statistics
   */
  public getModelConfigStats() {
    return this.configService.LLMModelConfig.getConfigStats();
  }
  
  /**
   * Clear model caches
   */
  public clearModelCaches(): void {
    this.models.clear();
    this.rawModels.clear();
    this.logger.log("Model caches cleared");
  }

}
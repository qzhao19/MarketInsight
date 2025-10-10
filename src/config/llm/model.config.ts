import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAIFields } from "@langchain/openai";

/**
 * Model configuration service
 */
@Injectable()
export class ModelConfigService {
  private readonly logger = new Logger(ModelConfigService.name);

  constructor(private readonly configService: ConfigService) {
    this.validateConfig();
  }

  /**
   * Validate configuration on service initialization
   */
  private validateConfig(): void {
    const config = {
      modelName: this.defaultModelName,
      temperature: this.defaultModelTemperature,
      topP: this.defaultModelTopP,
      frequencyPenalty: this.defaultModelFrequencyPenalty,
      presencePenalty: this.defaultModelPresencePenalty,
      maxTokens: this.defaultModelMaxTokens,
      maxConcurrency: this.defaultModelMaxConcurrency,
      maxRetries: this.defaultModelMaxRetries,
      timeout: this.defaultModelTimeout,
    };

    // Valid configs
    if (!this.validateTemperature(config.temperature)) {
      this.logger.warn(
        `Invalid temperature: ${config.temperature}. Must be between 0 and 2. Using default: 0`
      );
    }

    if (!this.validateTopP(config.topP)) {
      this.logger.warn(
        `Invalid topP: ${config.topP}. Must be between 0 and 1. Using default: 1`
      );
    }

    if (!this.validateFrequencyPenalty(config.frequencyPenalty)) {
      this.logger.warn(
        `Invalid frequencyPenalty: ${config.frequencyPenalty}. Must be between -2 and 2. Using default: 0`
      );
    }

    if (!this.validatePresencePenalty(config.presencePenalty)) {
      this.logger.warn(
        `Invalid presencePenalty: ${config.presencePenalty}. Must be between -2 and 2. Using default: 0`
      );
    }

    if (!this.validateMaxTokens(config.maxTokens)) {
      this.logger.warn(
        `Invalid maxTokens: ${config.maxTokens}. Must be between 1 and 32768. Using default: 4096`
      );
    }

    if (config.maxConcurrency <= 0) {
      this.logger.warn(
        `Invalid maxConcurrency: ${config.maxConcurrency}. Must be > 0. Using default: 10`
      );
    }

    if (config.maxRetries < 0) {
      this.logger.warn(
        `Invalid maxRetries: ${config.maxRetries}. Must be >= 0. Using default: 3`
      );
    }

    if (config.timeout <= 0) {
      this.logger.warn(
        `Invalid timeout: ${config.timeout}. Must be > 0. Using default: 60000`
      );
    }

    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `ModelConfig loaded:\n${JSON.stringify(config, null, 2)}`
      );
    }
  }

  /**
   * Safely get number from config with validation
   */
  private getNumber(key: string, defaultValue: number, min?: number, max?: number): number {
    const value = Number(this.configService.get<number>(key, defaultValue));
    
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
   * Safely get string from config
   */
  private getString(key: string, defaultValue: string): string {
    const value = this.configService.get<string>(key, defaultValue);
    
    if (!value || value.trim().length === 0) {
      this.logger.warn(
        `Empty or invalid string for ${key}. Using default: ${defaultValue}`
      );
      return defaultValue;
    }

    return value.trim();
  }

  // ==================== Model Configuration Getters ====================

  /**
   * Get default model name
   * Default: "deepseek-chat"
   */
  get defaultModelName(): string {
    return this.getString("DEFAULT_MODEL_NAME", "deepseek-chat");
  }

  /**
   * Get default model temperature (0-2)
   * Lower values = more deterministic, Higher values = more creative
   * Default: 0, Range: 0-2
   */
  get defaultModelTemperature(): number {
    return this.getNumber("DEFAULT_MODEL_TEMPERATURE", 0, 0, 2);
  }

  /**
   * Get default top P (0-1)
   * Nucleus sampling - controls diversity via cumulative probability
   * Default: 1, Range: 0-1
   */
  get defaultModelTopP(): number {
    return this.getNumber("DEFAULT_MODEL_TOP_P", 1, 0, 1);
  }

  /**
   * Get default frequency penalty (-2.0 to 2.0)
   * Reduces repetition of tokens based on their frequency in the text
   * Default: 0, Range: -2 to 2
   */
  get defaultModelFrequencyPenalty(): number {
    return this.getNumber("DEFAULT_MODEL_FREQUENCY_PENALTY", 0, -2, 2);
  }

  /**
   * Get default presence penalty (-2.0 to 2.0)
   * Reduces repetition of topics/ideas
   * Default: 0, Range: -2 to 2
   */
  get defaultModelPresencePenalty(): number {
    return this.getNumber("DEFAULT_MODEL_PRESENCE_PENALTY", 0, -2, 2);
  }

  /**
   * Get default max tokens
   * Maximum number of tokens to generate in the completion
   * Default: 4096, Range: 1-32768
   */
  get defaultModelMaxTokens(): number {
    return this.getNumber("DEFAULT_MODEL_MAX_TOKENS", 4096, 1, 32768);
  }

  /**
   * Get default max concurrency
   * Maximum number of concurrent requests to the model
   * Default: 10, Range: 1-1000
   */
  get defaultModelMaxConcurrency(): number {
    return this.getNumber("DEFAULT_MODEL_MAX_CONCURRENCY", 10, 1, 1000);
  }

  /**
   * Get default max retries
   * Maximum number of retry attempts for failed requests
   * Default: 3, Range: 0-10
   */
  get defaultModelMaxRetries(): number {
    return this.getNumber("DEFAULT_MODEL_MAX_RETRIES", 3, 0, 10);
  }

  /**
   * Get default timeout (ms)
   * Request timeout in milliseconds
   * Default: 60000 (60 seconds), Range: 1000-300000
   */
  get defaultModelTimeout(): number {
    return this.getNumber("DEFAULT_MODEL_TIMEOUT", 60000, 1000, 300000);
  }

  /**
   * Get default streaming flag
   * Whether to use streaming responses
   * Default: false
   */
  get defaultModelStreaming(): boolean {
    const value = this.configService.get<string>("DEFAULT_MODEL_STREAMING", "false");
    const lowerValue = String(value).toLowerCase().trim();
    return lowerValue === "true" || lowerValue === "1";
  }

  /**
   * Get default verbose flag
   * Whether to enable verbose logging
   * Default: false
   */
  get defaultModelVerbose(): boolean {
    const value = this.configService.get<string>("DEFAULT_MODEL_VERBOSE", "false");
    const lowerValue = String(value).toLowerCase().trim();
    return lowerValue === "true" || lowerValue === "1";
  }

  // ==================== Composite Configuration ====================

  /**
   * Get complete default model configuration
   * Returns a configuration object compatible with ChatOpenAIFields
   */
  get defaultModelConfig(): Partial<ChatOpenAIFields> {
    return {
      model: this.defaultModelName,
      temperature: this.defaultModelTemperature,
      topP: this.defaultModelTopP,
      frequencyPenalty: this.defaultModelFrequencyPenalty,
      presencePenalty: this.defaultModelPresencePenalty,
      maxTokens: this.defaultModelMaxTokens,
      maxConcurrency: this.defaultModelMaxConcurrency,
      maxRetries: this.defaultModelMaxRetries,
      timeout: this.defaultModelTimeout,
      streaming: this.defaultModelStreaming,
      verbose: this.defaultModelVerbose,
    };
  }

  // ==================== Validation Methods ====================

  /**
   * Validate temperature value
   * @param temperature - Temperature value to validate
   * @returns true if valid (0 <= temperature <= 2)
   */
  validateTemperature(temperature: number): boolean {
    return !isNaN(temperature) && temperature >= 0 && temperature <= 2;
  }

  /**
   * Validate top P value
   * @param topP - Top P value to validate
   * @returns true if valid (0 <= topP <= 1)
   */
  validateTopP(topP: number): boolean {
    return !isNaN(topP) && topP >= 0 && topP <= 1;
  }

  /**
   * Validate frequency penalty value
   * @param penalty - Frequency penalty value to validate
   * @returns true if valid (-2 <= penalty <= 2)
   */
  validateFrequencyPenalty(penalty: number): boolean {
    return !isNaN(penalty) && penalty >= -2.0 && penalty <= 2.0;
  }

  /**
   * Validate presence penalty value
   * @param penalty - Presence penalty value to validate
   * @returns true if valid (-2 <= penalty <= 2)
   */
  validatePresencePenalty(penalty: number): boolean {
    return !isNaN(penalty) && penalty >= -2.0 && penalty <= 2.0;
  }

  /**
   * Validate max tokens value
   * @param maxTokens - Max tokens value to validate
   * @returns true if valid (1 <= maxTokens <= 32768)
   */
  validateMaxTokens(maxTokens: number): boolean {
    return !isNaN(maxTokens) && maxTokens > 0 && maxTokens <= 32768;
  }

  /**
   * Validate max concurrency value
   * @param maxConcurrency - Max concurrency value to validate
   * @returns true if valid (maxConcurrency > 0)
   */
  validateMaxConcurrency(maxConcurrency: number): boolean {
    return !isNaN(maxConcurrency) && maxConcurrency > 0 && maxConcurrency <= 1000;
  }

  /**
   * Validate max retries value
   * @param maxRetries - Max retries value to validate
   * @returns true if valid (maxRetries >= 0)
   */
  validateMaxRetries(maxRetries: number): boolean {
    return !isNaN(maxRetries) && maxRetries >= 0 && maxRetries <= 10;
  }

  /**
   * Validate timeout value
   * @param timeout - Timeout value to validate in milliseconds
   * @returns true if valid (timeout > 0)
   */
  validateTimeout(timeout: number): boolean {
    return !isNaN(timeout) && timeout > 0 && timeout <= 300000;
  }

  /**
   * Validate complete model configuration
   * @param config - Configuration object to validate
   * @returns Object with validation results
   */
  validateModelConfig(config: Partial<ChatOpenAIFields>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (config.temperature !== undefined && !this.validateTemperature(config.temperature)) {
      errors.push(`Invalid temperature: ${config.temperature}. Must be between 0 and 2.`);
    }

    if (config.topP !== undefined && !this.validateTopP(config.topP)) {
      errors.push(`Invalid topP: ${config.topP}. Must be between 0 and 1.`);
    }

    if (config.frequencyPenalty !== undefined && !this.validateFrequencyPenalty(config.frequencyPenalty)) {
      errors.push(`Invalid frequencyPenalty: ${config.frequencyPenalty}. Must be between -2 and 2.`);
    }

    if (config.presencePenalty !== undefined && !this.validatePresencePenalty(config.presencePenalty)) {
      errors.push(`Invalid presencePenalty: ${config.presencePenalty}. Must be between -2 and 2.`);
    }

    if (config.maxTokens !== undefined && !this.validateMaxTokens(config.maxTokens)) {
      errors.push(`Invalid maxTokens: ${config.maxTokens}. Must be between 1 and 32768.`);
    }

    if (config.maxConcurrency !== undefined && !this.validateMaxConcurrency(config.maxConcurrency)) {
      errors.push(`Invalid maxConcurrency: ${config.maxConcurrency}. Must be > 0 and <= 1000.`);
    }

    if (config.maxRetries !== undefined && !this.validateMaxRetries(config.maxRetries)) {
      errors.push(`Invalid maxRetries: ${config.maxRetries}. Must be >= 0 and <= 10.`);
    }

    if (config.timeout !== undefined && !this.validateTimeout(config.timeout)) {
      errors.push(`Invalid timeout: ${config.timeout}. Must be > 0 and <= 300000.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Merge default config with custom config
   * Validates the merged result
   * @param customConfig - Custom configuration to merge
   * @returns Merged and validated configuration
   */
  mergeWithDefaults(customConfig: Partial<ChatOpenAIFields>): Partial<ChatOpenAIFields> {
    const merged = {
      ...this.defaultModelConfig,
      ...customConfig,
    };

    // Validate merged config
    const validation = this.validateModelConfig(merged);
    if (!validation.isValid) {
      this.logger.warn(
        `Configuration validation warnings:\n${validation.errors.join("\n")}`
      );
    }

    return merged;
  }

  /**
   * Get statistics about current configuration
   */
  getConfigStats() {
    return {
      modelName: this.defaultModelName,
      temperature: this.defaultModelTemperature,
      topP: this.defaultModelTopP,
      frequencyPenalty: this.defaultModelFrequencyPenalty,
      presencePenalty: this.defaultModelPresencePenalty,
      maxTokens: this.defaultModelMaxTokens,
      maxConcurrency: this.defaultModelMaxConcurrency,
      maxRetries: this.defaultModelMaxRetries,
      timeout: this.defaultModelTimeout,
      streaming: this.defaultModelStreaming,
      verbose: this.defaultModelVerbose,
    };
  }
}
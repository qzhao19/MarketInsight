import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAIFields } from '@langchain/openai';

@Injectable()
export class ModelConfigService {
  constructor(private readonly configService: ConfigService) {}

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
   * Get default model temperature (0-2)
   * Lower values = more deterministic, Higher values = more creative
   */
  get defaultModelTemperature(): number {
    return this.configService.get<number>('DEFAULT_MODEL_TEMPERATURE', 0);
  }

  /**
   * Get default top P (0-1)
   * Nucleus sampling - controls diversity via cumulative probability
   */
  get defaultModelTopP(): number {
    return this.configService.get<number>('DEFAULT_MODEL_TOP_P', 1);
  }

  /**
   * Get default frequency penalty (-2.0 to 2.0)
   * Reduces repetition of tokens based on their frequency in the text
   */
  get defaultModelFrequencyPenalty(): number {
    return this.configService.get<number>('DEFAULT_MODEL_FREQUENCY_PENALTY', 0);
  }

  /**
   * Get default presence penalty (-2.0 to 2.0)
   * Reduces repetition of topics/ideas
   */
  get defaultModelPresencePenalty(): number {
    return this.configService.get<number>('DEFAULT_MODEL_PRESENCE_PENALTY', 0);
  }

  /**
   * Get default max tokens
   * Maximum number of tokens to generate in the completion
   */
  get defaultModelMaxTokens(): number {
    return this.configService.get<number>('DEFAULT_MODEL_MAX_TOKENS', 4096);
  }

  /**
   * Get default max concurrency
   * Maximum number of concurrent requests to the model
   */
  get defaultModelMaxConcurrency(): number {
    return this.configService.get<number>('DEFAULT_MODEL_MAX_CONCURRENCY', 10);
  }

  /**
   * Get default max retries
   * Maximum number of retry attempts for failed requests
   */
  get defaultModelMaxRetries(): number {
    return this.configService.get<number>('DEFAULT_MODEL_MAX_RETRIES', 3);
  }

  /**
   * Get default timeout (ms)
   * Request timeout in milliseconds
   */
  get defaultModelTimeout(): number {
    return this.configService.get<number>('DEFAULT_MODEL_TIMEOUT', 60000);
  }


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
    };
  }

  // ==================== Validation Methods ====================

  /**
   * Validate temperature value
   */
  validateTemperature(temperature: number): boolean {
    return temperature >= 0 && temperature <= 2;
  }

  /**
   * Validate top P value
   */
  validateTopP(topP: number): boolean {
    return topP >= 0 && topP <= 1;
  }

  /**
   * Validate frequency penalty value
   */
  validateFrequencyPenalty(penalty: number): boolean {
    return penalty >= -2.0 && penalty <= 2.0;
  }

  /**
   * Validate presence penalty value
   */
  validatePresencePenalty(penalty: number): boolean {
    return penalty >= -2.0 && penalty <= 2.0;
  }

  /**
   * Validate max tokens value
   */
  validateMaxTokens(maxTokens: number): boolean {
    return maxTokens > 0 && maxTokens <= 32768; // Adjust based on model limits
  }

}
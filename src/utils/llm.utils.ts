import CircuitBreaker from "opossum";
import { ChatOpenAIFields } from "@langchain/openai";
import { CircuitBreakerConfig } from "../common/types/llm/client.types"
import { LLModelConfig } from "../common/types/llm/model.types"

/**
 * Convert our config to opossum's Options format
 */
export function toOpossumOptions(
  config: CircuitBreakerConfig
): CircuitBreaker.Options {
  return {
    timeout: config.timeout,
    errorThresholdPercentage: config.errorThresholdPercentage,
    resetTimeout: config.resetTimeout,
    rollingCountTimeout: config.rollingCountTimeout,
    volumeThreshold: config.volumeThreshold,
    capacity: config.capacity,
    name: config.name,
  };
}

export function toOpenAIConfig(
  modelConfig: LLModelConfig
): Partial<ChatOpenAIFields> {
  return {
    model: modelConfig.model,
    temperature: modelConfig.temperature,
    topP: modelConfig.topP,
    frequencyPenalty: modelConfig.frequencyPenalty,
    presencePenalty: modelConfig.presencePenalty,
    maxTokens: modelConfig.maxTokens,
    maxConcurrency: modelConfig.maxConcurrency,
    maxRetries: modelConfig.maxRetries,
    timeout: modelConfig.timeout,
    streaming: modelConfig.streaming === 1,
    verbose: modelConfig.verbose === 1,
  };
}

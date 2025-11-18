import CircuitBreaker from "opossum";
import { ChatOpenAIFields } from "@langchain/openai";

import { SearchResultItem } from "../types/llm/agent.types"
import { CircuitBreakerConfig } from "../types/llm/client.types"
import { LLModelConfig } from "../types/llm/model.types"

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

export function validateAndEnrichResearchContext(
  parsedContext: any, userContext: any
) {
  return {
    industry: parsedContext.industry || userContext.industry || "Not specified",
    geographicScope: parsedContext.geographicScope || userContext.geographicScope || "Global",
    timeFrame: {
      historical: parsedContext.timeFrame?.historical || "2019-2023",
      current: parsedContext.timeFrame?.current || "2024",
      forecast: parsedContext.timeFrame?.forecast || "2025-2030"
    },
    specialFocus: [
      ...(parsedContext.specialFocus || []),
      ...(userContext.specialFocus || [])
    ].filter((item, index, arr) => arr.indexOf(item) === index), // duplicate
    urgency: parsedContext.urgency || "medium",
    complexity: parsedContext.complexity || "medium"
  };
};

export function formatSearchResults(
  searchResults: SearchResultItem[]
): Array<{query: string, result: string}> {
  return searchResults.map(item => {
    let resultText: string;
    try {
      const parsed = JSON.parse(item.result);
      if (Array.isArray(parsed)) {
        resultText = parsed.join('\n');
      } else {
        resultText = String(parsed);
      }
    } catch {
      // If parsing fails, use the original string
      resultText = item.result;
    }
    return { query: item.query, result: resultText };
  });
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
    streaming: modelConfig.streaming === 1,  // Convert from number to boolean
    verbose: modelConfig.verbose === 1,      // Convert from number to boolean
  };
}

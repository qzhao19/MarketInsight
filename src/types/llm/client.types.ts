import { OpenAI as OpenAIClient } from "openai";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAICallOptions } from "@langchain/openai";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base"
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { 
  BaseChatModel,  
  BindToolsInput 
} from "@langchain/core/language_models/chat_models";

/**
 * Configuration for circuit breaker 
 */
export interface CircuitBreakerConfig {
  resetTimeout: number;
  timeout?: number;
  errorThresholdPercentage?: number;
  rollingCountTimeout?: number;
  volumeThreshold?: number;
  capacity?:number;
  name?: string;
}

/**
 * Configuration for rate limiter
 */
export interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxQueueSize: number;
  requestTimeout: number;
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
 * Type representing a single tool definition for OpenAI responses.
 * Extracted from OpenAIClient.Responses.ResponseCreateParams["tools"].
 */
type ResponsesTool = NonNullable<
  OpenAIClient.Responses.ResponseCreateParams["tools"]
>[number];

/**
 * Supported tool types for ChatOpenAI models.
 * - BindToolsInput: LangChain tool binding input
 * - OpenAIClient.Chat.ChatCompletionTool: OpenAI chat completion tool definition
 * - ResponsesTool: OpenAI response tool definition
 */
export type ChatOpenAIToolType =
  | BindToolsInput
  | OpenAIClient.Chat.ChatCompletionTool
  | ResponsesTool;

/**
 * LLMChatModel is a union type representing all supported chat model variants
 * that can be used by the ModelClient. It includes:
 * - BaseChatModel: The standard LangChain chat model interface.
 * - Runnable<BaseLanguageModelInput, Record<string, any>, RunnableConfig<Record<string, any>>>:
 *   A generic Runnable model that accepts language model input and returns a generic record.
 * - Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenAICallOptions>:
 *   A Runnable model that accepts language model input and returns AIMessageChunk,
 *   typically used for structured output or tool-augmented chat models.
 *
 * This type allows ModelClient and related logic to flexibly support both native
 * chat models and transformed models (e.g., with tools or structured output).
 */
export type LLMChatModelType =  
  | BaseChatModel
  | Runnable<BaseLanguageModelInput, Record<string, any>, RunnableConfig<Record<string, any>>>
  | Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenAICallOptions>;
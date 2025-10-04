import { OpenAI as OpenAIClient } from "openai";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

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
 * Generic record type for arbitrary key-value objects.
 */
export type AnyRecord = Record<string, any>;

/**
 * Structure representing research parameters for a specific analysis section.
 * - keyQuestions: List of key research questions
 * - searchQueries: List of search queries to answer the questions
 * - priority: Priority level for this research section
 */
export interface ResearchParams {
  keyQuestions: string[];
  searchQueries: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Structure representing a full research plan.
 * - industry: Target industry or product
 * - geographicScope: Geographic scope of the research
 * - timeFrame: Time periods for historical, current, and forecast analysis
 * - specialFocus: List of special focus topics
 * - macroAnalysisParams: Parameters for macroeconomic analysis
 * - segmentationAnalysisParams: Parameters for segmentation analysis
 * - trendAnalysisParams: Parameters for trend analysis
 */
export interface ResearchPlan {
  industry: string;
  geographicScope: string;
  timeFrame: {
    historical: string;
    current: string;
    forecast: string;
  };
  specialFocus: string[];
  macroAnalysisParams: ResearchParams;
  segmentationAnalysisParams: ResearchParams;
  trendAnalysisParams: ResearchParams;
}

/**
 * Structure representing a single search result item.
 * - query: The search query string
 * - result: The result string (usually JSON or plain text)
 */
export type SearchResultItem = {
  query: string;
  result: string;
};


import { LLModelConfig } from "./model.types";

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
export interface SearchResultItem {
  query: string;
  result: string;
};

/**
 * Options for invoking market research analysis
 * Separates model configuration from client protection settings
 */
export interface MarketResearchInvokeOptions {
  /** Additional user context for research */
  userContext?: Record<string, any>;
  
  /** Model configuration (LangChain ChatOpenAIFields) */
  modelConfig?: LLModelConfig;
}

/**
 * Result structure for market research analysis
 */
export interface MarketResearchResult {
  /** Whether the analysis was successful */
  success: boolean;
  
  /** Analysis result data (if successful) */
  result?: any;
  
  /** Error message (if failed) */
  error?: string;
}

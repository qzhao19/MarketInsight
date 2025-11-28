import { 
  TaskExecutionResult, 
  FinalMarketingReport 
} from "../agent/agent.types";

// ==================== Campaign Input/Result Types ====================

/**
 * Campaign input structure - stored in Campaign.input
 * Contains the user's prompt and context for Agent execution
 */
export interface CampaignInput {
  userPrompt: string;
  userContext?: Record<string, any>;
}

/**
 * Campaign result - stored in Campaign.result
 * Directly references FinalMarketingReport from agent.types
 */
export type CampaignResult = FinalMarketingReport;

// ==================== Task Result Type ====================

/**
 * Task result - stored in Task.result
 * Directly references TaskExecutionResult from agent.types
 * Note: taskName can be obtained from result.taskName
 */
export type TaskResult = TaskExecutionResult;
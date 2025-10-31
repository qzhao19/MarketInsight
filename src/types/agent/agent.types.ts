
/**
 * Task metadata - LLM dynamically generated individual tasks
 */
export interface MarketingTaskMetadata {
  taskId: string;
  taskName: string;
  taskDescription?: string;
  priority: "high" | "medium" | "low";
  dependencies: string[];
};

/**
 * Dynamic reporting framework LLM-generated complete report structure
 */
export interface MarketingReportFramework {
  reportTitle: string;
  reportObjective: string;
  tasks: MarketingTaskMetadata[];
}

/**
 * Task plan - A detailed plan generated for a single mission
 */
export interface MarketingTaskPlan {
  taskId: string; 
  researchGoal: string;
  searchDirections: string[];
  searchQueries: string[];
  keyElements: string[];
  specialFocus?: string[];
  timeFrame?: {
    historical?: string;
    current?: string;
    forecast?: string;
  };
};

/**
 * Task execution batch - tasks that can be executed in parallel
 */
export interface TaskExecutionBatch {
  batchNumber: number;
  taskIds: string[];
  description: string;
}

/**
 * Task execution schedule - complete execution plan
 */
export interface TaskExecutionSchedule {
  executionBatches: TaskExecutionBatch[];
  taskOrder: string[];  // Topologically sorted task IDs
  totalBatches: number;
}

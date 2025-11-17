
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

/**
 * Optimized search query
 */
export interface OptimizedQuery {
  originalQuery: string;
  optimizedQuery: string;
  reasoning?: string;
}

/**
 * Search result items
 */
export interface SearchResultItem {
  query: string;
  result: string;
};

/**
 * Intermediate results of task execution
 */
export interface TaskExecutionResult {
  taskId: string;
  taskName: string;
  status: "success" | "failed";
  optimizedQueries: OptimizedQuery[];
  totalSearchResults: number;
  structuredContent: {
    summary: string;
    keyFindings: string[];
    dataPoints: Record<string, any>;
    sources: string[];
  };
  error?: string;
}

/**
 * Task execution configuration
 */
export interface TaskExecutionConfig {
  maxQueriesPerTask: number; // Maximum number of queries to optimize per task
  searchTimeout: number; // ms, single search timeout duration
  maxRetries: number; // Number of retries for failed searches
  parallelSearches: boolean; // Whether to execute searches in parallel
}

/**
 * Report section
 */
export interface ReportSection {
  sectionTitle: string;
  content: string;
  keyFindings: string[];
  dataPoints: Record<string, any>;
  relatedTaskIds: string[];
}

/**
 * 
 */
export interface FinalMarketingReport {
  reportTitle: string;
  reportObjective: string;
  
  // Executive summary
  executiveSummary: {
    overview: string;
    keyHighlights: string[];
    recommendations: string[];
  };

  // Main sections
  sections: ReportSection[];

  // Conclusion
  conclusion: {
    summary: string;
    limitations: string[];
  };

  // Metadata
  generatedAt: string;
  totalTasks: number;
  successfulTasks: number;
}
import { z } from "zod";

/**
 * Schema for LLM to generate task metadata
 * Corresponds to MarketingTaskMetadata interface
 */
const TaskMetadataSchema = z.object({
  taskName: z.string()
    .min(1, "Task name cannot be empty")
    .describe("Task name, concise and clear"),

  taskDescription: z.string()
    .optional()
    .describe("Detailed description of the task"),
  
  priority: z.enum(["high", "medium", "low"])
    .describe("Task priority level: high, medium, or low"),
  
  dependencies: z.array(z.string())
    .default([])
    .describe("List of task names this task depends on. Empty array if no dependencies."),
})
.strict()  // Avoid LLM add extra attribute
.describe("Metadata for a marketing research task");

/**
 * Schema for report framework (LLM output)
 */
export const ReportFrameworkSchema = z.object({
  reportTitle: z.string()
    .min(1, "Report name cannot be empty")
    .max(200, "Report title cannot exceed 200 characters")
    .trim()
    .describe("Complete report title"),
  
  reportObjective: z.string()
    .min(10, "Report objective must be at least 10 characters")
    .max(1000, "Report objective cannot exceed 1000 characters")
    .trim()
    .describe("Main objective of the report"),
  
  tasks: z.array(TaskMetadataSchema)
    .min(1, "Report must include at least 1 research task")
    .max(20, "Report cannot have more than 20 research tasks")
    .describe("List of research tasks to be executed (1-20 tasks)")
    .refine(
      (tasks) => new Set(tasks.map(t => t.taskName)).size === tasks.length,
      { message: "Task names must be unique within a report" }
    ),
})
.strict()
.describe("Marketing report framework with structure and research tasks");

/**
 * Schema for time frame specification
 */
const TimeFrameSchema = z.object({
  historical: z.string()
    .optional()
    .describe("Historical time period to analyze (e.g., '2010-2020', 'past 5 years')"),
  
  current: z.string()
    .optional()
    .describe("Current time period (e.g., '2024', 'Q1 2024', 'latest')"),
  
  forecast: z.string()
    .optional()
    .describe("Future forecast period (e.g., '2025-2030', 'next 3 years')"),
})
.strict()
.describe("Time frame specification for research");

/**
 * Schema for task research plan (LLM output)
 * Corresponds to MarketingTaskPlan interface
 */
export const TaskPlanSchema = z.object({
  researchGoal: z.string()
    .min(10, "Research goal must be at least 10 characters")
    .max(1000, "Research goal cannot exceed 1000 characters")
    .trim()
    .describe("Clear and specific research objective for this task"),
  
  searchDirections: z.array(z.string())
    .min(1, "Must have at least 1 search direction")
    .max(10, "Cannot have more than 10 search directions")
    .describe("List of research directions/dimensions to explore (e.g., 'market size', 'growth rate', 'competitors')")
    .refine(
      (directions) => directions.every(d => d.trim().length > 0),
      { message: "Search directions cannot be empty strings" }
    ),
  
  searchQueries: z.array(z.string())
    .min(1, "Must have at least 1 search query")
    .max(15, "Cannot have more than 15 search queries")
    .describe("List of initial search queries to execute (will be optimized later)")
    .refine(
      (queries) => queries.every(q => q.trim().length >= 5),
      { message: "Search queries must be at least 5 characters" }
    ),
  
  keyElements: z.array(z.string())
    .min(1, "Must identify at least 1 key element")
    .max(15, "Cannot have more than 15 key elements")
    .describe("List of key data elements/metrics to extract (e.g., 'market value in USD', 'CAGR', 'top 5 players')")
    .refine(
      (elements) => elements.every(e => e.trim().length > 0),
      { message: "Key elements cannot be empty strings" }
    ),
  
  specialFocus: z.array(z.string())
    .optional()
    .describe("Optional: Areas requiring special attention or deeper analysis"),
  
  timeFrame: TimeFrameSchema
    .optional()
    .describe("Optional: Specific time periods to focus on for data collection"),
})
.strict()
.describe("Detailed research plan for a marketing task");

/**
 * Schema for optimized query output
 */
export const OptimizedQuerySchema = z.object({
  originalQuery: z.string()
    .min(1, "Original query cannot be empty")
    .describe("The original search query"),
    
  optimizedQuery: z.string()
    .min(5, "Optimized query must be at least 5 characters")
    .describe("The enhanced search query with additional context, time periods, and specificity"),
  
  reasoning: z.string()
    .optional()
    .describe("Brief explanation of optimization strategy"),
})
.strict()
.describe("Optimized search query with reasoning");

/**
 * Schema for query optimization output (batch)
 */
export const OptimizedQueriesSchema = z.object({
  optimizedQueries: z.array(OptimizedQuerySchema)
    .min(1)
    .describe("List of optimized search queries"),
})
.strict()
.describe("Batch query optimization output");


/**
 * Schema for structured content output (simplified, direct generation)
 */
export const StructuredContentSchema = z.object({
  summary: z.string()
    .min(100, "Summary must be at least 100 characters")
    .max(2000, "Summary cannot exceed 2000 characters")
    .describe("Comprehensive narrative summary of research findings"),
  
  keyFindings: z.array(z.string())
    .min(3, "Must have at least 3 key findings")
    .max(10, "Cannot have more than 10 key findings")
    .describe("List of key insights and findings with supporting data"),
  
  dataPoints: z.record(z.string(), z.any())
    .describe("Structured data points extracted from research (key-value pairs)"),
  
  sources: z.array(z.string())
    .min(1, "Must cite at least 1 source snippet")
    .describe("List of snippet identifiers used (e.g., snippet-1, snippet-2)"),
})
.strict()
.describe("Structured content for task research output");


// const ReportSectionSchema = z.object({
//   sectionTitle: z.string()
//     .min(3)
//     .describe("Section title"),
  
//   content: z.string()
//     .min(100)
//     .describe("Main content (100+ words)"),
  
//   keyFindings: z.array(z.string())
//     .min(1)
//     .describe("Key findings"),
  
//   dataPoints: z.record(z.string(), z.any())
//     .describe("Relevant data points"),
  
//   relatedTaskIds: z.array(z.string())
//     .describe("Source task IDs"),
// })
// .strict()
// .describe("Report section for final report");

// const ReportSectionSchema = z.object({
//   sectionTitle: z.string()
//     .min(3, "Section title must be at least 3 characters")
//     .max(100, "Section title cannot exceed 100 characters")
//     .describe("Section title (3-100 characters)"),
  
//   content: z.string()
//     .min(100, "Section content must be at least 100 characters")
//     .max(3000, "Section content cannot exceed 3000 characters")
//     .describe("Main content (100-3000 characters, focus on concise narrative)"),
  
//   keyFindings: z.array(z.string().max(300, "Each finding cannot exceed 300 characters"))
//     .min(1, "Must have at least 1 key finding")
//     .max(5, "Cannot have more than 8 key findings")
//     .describe("Key findings (1-8 items, each max 300 chars)"),
  
//   dataPoints: z.record(z.string(), z.any())
//     .describe("Relevant data points (keep concise)"),
  
//   relatedTaskIds: z.array(z.string())
//     .max(10, "Cannot reference more than 10 tasks per section")
//     .describe("Source task IDs (max 10)"),
// })
// .strict()
// .describe("Report section for final report");


// export const FinalMarketingReportSchema = z.object({
//   reportTitle: z.string(),
//   reportObjective: z.string(),
//   executiveSummary: z.object({
//     overview: z.string().min(200),
//     keyHighlights: z.array(z.string()).min(2).max(5),
//     criticalInsights: z.array(z.string()).min(2).max(5),
//     recommendations: z.array(z.string()).min(2).max(5),
//   }),
//   sections: z.array(ReportSectionSchema).min(1),
//   consolidatedData: z.object({
//     allDataPoints: z.record(z.string(), z.any()),
//     keyMetrics: z.record(z.string(), z.any()),
//     dataSources: z.array(z.string()),
//   }),
//   conclusion: z.object({
//     summary: z.string().min(100),
//     strategicRecommendations: z.array(z.string()).min(2).max(5),
//     futureOutlook: z.string().min(50),
//     limitations: z.array(z.string()),
//   }),
// })
// .strict()
// .describe("Final marketing report schema");



// export const FinalMarketingReportSchema = z.object({
//   reportTitle: z.string()
//     .min(5, "Report title must be at least 5 characters")
//     .max(150, "Report title cannot exceed 150 characters")
//     .describe("Report title (5-150 characters)"),
  
//   reportObjective: z.string()
//     .min(20, "Report objective must be at least 20 characters")
//     .max(500, "Report objective cannot exceed 500 characters")
//     .describe("Report objective (20-500 characters)"),
  
//   executiveSummary: z.object({
//     overview: z.string()
//       .min(200, "Overview must be at least 200 characters")
//       .max(2500, "Overview cannot exceed 2500 characters") // 
//       .describe("Executive overview (200-2500 characters)"),
    
//     keyHighlights: z.array(
//       z.string()
//         .min(20, "Each highlight must be at least 20 characters")
//         .max(200, "Each highlight cannot exceed 200 characters") // 
//     )
//       .min(2, "Must have at least 2 key highlights")
//       .max(5, "Cannot have more than 5 key highlights")
//       .describe("Key highlights (2-5 items, each 20-200 chars)"),
    
//     criticalInsights: z.array(
//       z.string()
//         .min(20, "Each insight must be at least 20 characters")
//         .max(250, "Each insight cannot exceed 250 characters") 
//     )
//       .min(2, "Must have at least 2 critical insights")
//       .max(5, "Cannot have more than 5 critical insights")
//       .describe("Critical insights (2-5 items, each 20-250 chars)"),
    
//     recommendations: z.array(
//       z.string()
//         .min(20, "Each recommendation must be at least 20 characters")
//         .max(200, "Each recommendation cannot exceed 200 characters")
//     )
//       .min(2, "Must have at least 2 recommendations")
//       .max(5, "Cannot have more than 5 recommendations")
//       .describe("Recommendations (2-5 items, each 20-200 chars)"),
//   })
//     .describe("Executive summary with strict length limits"),
  
//   sections: z.array(ReportSectionSchema)
//     .min(1, "Must have at least 1 section")
//     .max(8, "Cannot have more than 8 sections")
//     .describe("Report sections (1-8 sections)"),

//   consolidatedData: z.object({
//     allDataPoints: z.record(z.string(), z.any())
//       .describe("All data points (keep concise)"),
    
//     keyMetrics: z.record(z.string(), z.any())
//       .describe("Key metrics (top 10-15 recommended)"),
    
//     dataSources: z.array(z.string())
//       .max(50, "Cannot have more than 50 data sources")
//       .describe("Data sources (max 50)"),
//   })
//     .describe("Consolidated data with limits"),
  
//   conclusion: z.object({
//     summary: z.string()
//       .min(100, "Summary must be at least 100 characters")
//       .max(1500, "Summary cannot exceed 1500 characters")
//       .describe("Conclusion summary (100-1500 characters)"),
    
//     strategicRecommendations: z.array(
//       z.string()
//         .min(20, "Each recommendation must be at least 20 characters")
//         .max(250, "Each recommendation cannot exceed 250 characters") 
//     )
//       .min(2, "Must have at least 2 strategic recommendations")
//       .max(5, "Cannot have more than 5 strategic recommendations")
//       .describe("Strategic recommendations (2-5 items, each 20-250 chars)"),
    
//     futureOutlook: z.string()
//       .min(50, "Future outlook must be at least 50 characters")
//       .max(1000, "Future outlook cannot exceed 1000 characters")
//       .describe("Future outlook (50-1000 characters)"),
    
//     limitations: z.array(
//       z.string()
//         .min(10, "Each limitation must be at least 10 characters")
//         .max(200, "Each limitation cannot exceed 200 characters")
//     )
//       .max(5, "Cannot have more than 5 limitations")
//       .describe("Limitations (0-5 items, each 10-200 chars)"),
//   })
//     .describe("Conclusion with strict length limits"),
// })
// .strict()
// .describe("Final marketing report schema with comprehensive length constraints");


/**
 * Report metadata (title + objective)
 */
export const ReportMetadataSchema = z.object({
  reportTitle: z.string()
    .min(5, "Report title must be at least 5 characters")
    .max(150, "Report title cannot exceed 150 characters")
    .describe("Report title (5-150 characters)"),

  reportObjective: z.string()
    .min(20, "Report objective must be at least 20 characters")
    .max(500, "Report objective cannot exceed 500 characters")
    .describe("Report objective (20-500 characters)"),
})
.strict()
.describe("Report title and objective");

/**
 * Executive summary only
 */
export const ExecutiveSummaryOnlySchema = z.object({
  overview: z.string()
    .min(200, "Overview must be at least 200 characters")
    .max(2000, "Overview cannot exceed 2000 characters")
    .describe("Executive overview (200-2500 characters)"),

  keyHighlights: z.array(
    z.string()
      .min(20, "Each highlight must be at least 20 characters")
      .max(200, "Each highlight cannot exceed 200 characters")
    )
    .min(2, "Must have at least 2 key highlights")
    .max(5, "Cannot have more than 5 key highlights")
    .describe("Key highlights (2-5 items, each 20-200 chars)"),
  
  criticalInsights: z.array(
    z.string()
      .min(20, "Each insight must be at least 20 characters")
      .max(250, "Each insight cannot exceed 250 characters") 
  )
    .min(2, "Must have at least 2 critical insights")
    .max(5, "Cannot have more than 5 critical insights")
    .describe("Critical insights (2-5 items, each 20-250 chars)"),
  
  recommendations: z.array(
    z.string()
      .min(20, "Each recommendation must be at least 20 characters")
      .max(200, "Each recommendation cannot exceed 200 characters")
  )
    .min(2, "Must have at least 2 recommendations")
    .max(5, "Cannot have more than 5 recommendations")
    .describe("Recommendations (2-5 items, each 20-200 chars)"),  
})
.strict()
.describe("xecutive summary with strict length limits");

/**
 * Single section (generated one by one)
 */
export const SingleSectionSchema = z.object({
  sectionTitle: z.string()
    .min(3, "Section title must be at least 3 characters")
    .max(100, "Section title cannot exceed 100 characters")
    .describe("Section title (3-100 characters)"),
  
  content: z.string()
    .min(100, "Section content must be at least 100 characters")
    .max(3000, "Section content cannot exceed 3000 characters")
    .describe("Main content (100-3000 characters, focus on concise narrative)"),
  
  keyFindings: z.array(z.string().max(300, "Each finding cannot exceed 300 characters"))
    .min(1, "Must have at least 1 key finding")
    .max(5, "Cannot have more than 8 key findings")
    .describe("Key findings (1-8 items, each max 300 chars)"),
  
  dataPoints: z.record(z.string(), z.any())
    .describe("Relevant data points (keep concise)"),
  
  relatedTaskIds: z.array(z.string())
    .max(10, "Cannot reference more than 10 tasks per section")
    .describe("Source task IDs (max 10)"),
})
.strict()
.describe("Report section for final report");

/**
 * Consolidated data
 */
export const ConsolidatedDataSchema = z.object({
  allDataPoints: z.record(z.string(), z.any())
    .describe("All data points (keep concise)"),
  
  keyMetrics: z.record(z.string(), z.any())
    .describe("Key metrics (top 10-15 recommended)"),
  
  dataSources: z.array(z.string())
    .max(50, "Cannot have more than 50 data sources")
    .describe("Data sources (max 50)"),
})
.strict()
.describe("Consolidated data with limits");

/**
 * 
 */
export const ConclusionSchema = z.object({
  summary: z.string()
    .min(100, "Summary must be at least 100 characters")
    .max(1500, "Summary cannot exceed 1500 characters")
    .describe("Conclusion summary (100-1500 characters)"),

  strategicRecommendations: z.array(
    z.string()
      .min(20, "Each recommendation must be at least 20 characters")
      .max(250, "Each recommendation cannot exceed 250 characters") 
  )
    .min(2, "Must have at least 2 strategic recommendations")
    .max(5, "Cannot have more than 5 strategic recommendations")
    .describe("Strategic recommendations (2-5 items, each 20-250 chars)"),

  futureOutlook: z.string()
    .min(50, "Future outlook must be at least 50 characters")
    .max(1000, "Future outlook cannot exceed 1000 characters")
    .describe("Future outlook (50-1000 characters)"),

  limitations: z.array(
    z.string()
      .min(10, "Each limitation must be at least 10 characters")
      .max(200, "Each limitation cannot exceed 200 characters")
  )
    .max(5, "Cannot have more than 5 limitations")
    .describe("Limitations (0-5 items, each 10-200 chars)"),
})
.strict()
.describe("Conclusion with strict length limits");



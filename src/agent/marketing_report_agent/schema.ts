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


import { z } from "zod"; 

export const ResearchContextSchema = z.object({
  industry: z.string().describe("Target industry/product name"),
  geographicScope: z.string().describe("Geographic scope (e.g., Global, China, North America)"),
  timeFrame: z.object({
    historical: z.string().describe("Historical analysis time period"),
    current: z.string().describe("Current base year"),
    forecast: z.string().describe("Forecast timeframe")
  }),
  specialFocus: z.array(z.string()).describe("Special focus points"),
  urgency: z.enum(["high", "medium", "low"]).describe("Urgency level"),
  complexity: z.enum(["high", "medium", "low"]).describe("Complexity level")
}).describe("Market research context information");

export const ResearchPlanSchema = z.object({
  macro: z.object({
    keyQuestions: z.array(z.string()).describe("Key questions for macro analysis"),
    searchQueries: z.array(z.string()).describe("Search queries for macro research"),
    priority: z.enum(["high", "medium", "low"]).describe("Priority level")
  }),
  segmentation: z.object({
    keyQuestions: z.array(z.string()).describe("Key questions for market segmentation"),
    searchQueries: z.array(z.string()).describe("Search queries for segmentation research"),
    priority: z.enum(["high", "medium", "low"]).describe("Priority level")
  }),
  trend: z.object({
    keyQuestions: z.array(z.string()).describe("Key questions for trend analysis"),
    searchQueries: z.array(z.string()).describe("Search queries for trend research"),
    priority: z.enum(["high", "medium", "low"]).describe("Priority level")
  })
}).describe("Research plan with detailed analysis parameters");

export const OptimizedQueriesSchema = z.object({
  keyQuestions: z.array(z.string()).describe("Key questions that these queries aim to answer"),
  searchQueries: z.array(z.string()).max(3).describe("Optimized search queries (maximum 3)"),
  priority: z.enum(["high", "medium", "low"]).describe("Priority level for these queries")
}).describe("Optimized search queries for market research");
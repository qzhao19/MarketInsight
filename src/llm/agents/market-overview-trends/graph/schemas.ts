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

export const ResearchQueriesSchema = z.object({
  keyQuestions: z.array(z.string()).min(3).max(5).describe("Key questions that these queries aim to answer"),
  searchQueries: z.array(z.string()).min(3).max(5).describe("Optimized search queries (maximum 5)"),
  priority: z.enum(["high", "medium", "low"]).describe("Priority level for these queries")
}).describe("Optimized search queries for market research");

export const ResearchPlanSchema = z.object({
  macro: ResearchQueriesSchema.describe("Macroeconomic analysis parameters"),
  segmentation: ResearchQueriesSchema.describe("Market segmentation analysis parameters"),
  trend: ResearchQueriesSchema.describe("Market trend analysis parameters")
}).describe("Research plan with detailed analysis parameters");;


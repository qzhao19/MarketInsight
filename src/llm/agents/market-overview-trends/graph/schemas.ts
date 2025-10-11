import { z } from "zod";

// Research Context Schema
export const ResearchContextSchema = z.object({
  industry: z.string().describe("The specific industry or product being researched"),
  geographicScope: z.string().describe("Geographic scope: global, regional, or country-specific"),
  timeFrame: z.object({
    historical: z.string().describe("Historical period for analysis (e.g., '2019-2023')"),
    current: z.string().describe("Current year for analysis (e.g., '2024')"),
    forecast: z.string().describe("Forecast period (e.g., '2025-2030')")
  }).describe("Time frame for the research"),
  specialFocus: z.array(z.string()).describe("Special focus points or aspects of interest"),
  urgency: z.enum(["high", "medium", "low"]).describe("Urgency level of the request"),
  complexity: z.enum(["high", "medium", "low"]).describe("Complexity level of analysis needed")
});

// Analysis Parameters Schema (sub-schema)
const AnalysisParamsSchema = z.object({
  keyQuestions: z.array(z.string())
    .min(3)
    .max(10)
    .describe("3-10 key research questions to guide the analysis"),
  searchQueries: z.array(z.string())
    .min(3)
    .max(10)
    .describe("3-10 optimized search queries for gathering information"),
  priority: z.enum(["high", "medium", "low"])
    .describe("Priority level for this analysis component")
});

// Use stricter schema definitions to ensure JSON formatting.
export const ResearchPlanSchema = z.object({
  macro: AnalysisParamsSchema.describe("Macroeconomic analysis parameters"),
  segmentation: AnalysisParamsSchema.describe("Market segmentation analysis parameters"),
  trend: AnalysisParamsSchema.describe("Trend analysis parameters")
}).strict();  // Add .strict() to avoid extra attribute

// Research Queries Schema
export const ResearchQueriesSchema = z.object({
  searchQueries: z.array(z.string())
    .min(3)
    .max(10)
    .describe("3-10 optimized search queries")
}).strict();  // Add .strict()
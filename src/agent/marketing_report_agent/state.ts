import { Annotation } from "@langchain/langgraph";
import { 
  MarketingTaskPlan,
  MarketingReportFramework,
} from "../../types/agent/agent.types"

/**
 * Marketing Research Agent State
 */
export const MarketingResearchState = Annotation.Root({
  
  /**
   * The original user input from user
   * 
   * example: analysis of China's new EV market in 2024
   */
  userInput: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),

  /**
   * The user context stores additional metadata.
   * 
   * {
   *   targetAudience: "",
   *   region: "",
   *   timeframe: "",
   *   depth: "",
   *   language: "",
   *   focusAreas: ["xxx", ...]
   *   ...
   * }
   */
  userContext: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  /**
   * Dynamic reporting framework, LLM-generated complete report structure
   * 
   * Input: userInput + userContext
   * 
   * Includes:
   * - reportTitle
   * - reportObjective
   * - tasks: dynamically generated task list
   */
  reportFramework: Annotation<MarketingReportFramework | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  /**
   * The task plan for the project, detailed research plan generated for each task
   * 
   * Input: single taskMetadata
   * 
   * Struct: Map<taskId, MarketingTaskPlan>
   * 
   */
  taskPlans: Annotation<Map<string, MarketingTaskPlan>>({
    reducer: (x, y) => {
      const merged = new Map(x);
      if (y) {
        y.forEach((value, key) => merged.set(key, value));
      }
      return merged;
    },
    default: () => new Map(),
  }),



});


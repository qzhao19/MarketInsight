import {
  HumanMessage,
} from "@langchain/core/messages";
import { SerpAPI } from "@langchain/community/tools/serpapi";

import { ResearchPlan, MarketResearchState } from "./state"
import { 
  createContextExtractionPrompt, 
  createResearchPlanPrompt,
  createMacroAnalysisPrompt, 
  createSynthesisPrompt } from "./config/prompts";
import { ResearchContextSchema, ResearchPlanSchema } from "./config/schemas"
import { 
  alignStructureMessage,
  createDefaultResearchContext, 
  createDefaultResearchPlan, 
  validateAndEnrichContext 
} from "./utils/index"


/**
 * 
 */
export async function planResearchTasks(
  state: typeof MarketResearchState.State,
  config: any
): Promise<Partial<typeof MarketResearchState.State>> {

  let researchContext;
  const model = config.configurable.model;

  // 1. Create a structured output model for extracting research context
  try {
    const contextExtractionPrompt = createContextExtractionPrompt(state.userInput);
    const structuredContextModel = model.withStructuredOutput(ResearchContextSchema, {
      name: "ResearchContextExtraction"
    });

    const result = await structuredContextModel.invoke(
      new HumanMessage(contextExtractionPrompt)
    );

    researchContext = alignStructureMessage<any>(result, "research context");
  } catch (error) {
    console.warn("Failed to extract structured context:", error);
    researchContext = createDefaultResearchContext(state.userInput);
  }

  // Verify the integrity of the parsing results
  researchContext = validateAndEnrichContext(researchContext, state.userContext);

  // 2. Create a structured output model for generating research plans
  let detailedPlan;
  try {
    const researchPlanPrompt = createResearchPlanPrompt(researchContext);
    const structuredPlanModel = model.withStructuredOutput(ResearchPlanSchema, {
      name: "ResearchPlanGeneration"
    });
    
    const result = await structuredPlanModel.invoke(
      new HumanMessage(researchPlanPrompt)
    );
    
    detailedPlan = alignStructureMessage<any>(result, "research plan");
  } catch (error) {
    console.warn("Failed to generate structured research plan:", error);
    detailedPlan = createDefaultResearchPlan(researchContext);
  }

  // Create research plan
  const researchPlan: ResearchPlan = {
    ...researchContext,
    macroAnalysisParams: detailedPlan.macro,
    segmentationAnalysisParams: detailedPlan.segmentation,
    trendAnalysisParams: detailedPlan.trend
  };

  return {
      researchPlan,
      userContext: {
        ...state.userContext,
        ...researchContext,
      },
      nextStep: "execute_parallel_research",
    };
};


export async function macroAnalysisTask(
  state: typeof MarketResearchState.State,
  config: any
): Promise<Partial<typeof MarketResearchState.State>> {
  const model = config.configurable.model;
  const { researchPlan } = state;

  if (!researchPlan || !researchPlan.macroAnalysisParams) {
    console.error("Macro analysis cannot proceed: researchPlan or macroAnalysisParams are missing from the state.");
    return {
      macroAnalysisResult: "Error: Missing research plan or macro analysis parameters",
      nextStep: "handle_error",
    };
  }

  try {
    // Optimizing search queries
    const queryOptimizationPrompt = createMacroAnalysisPrompt(researchPlan);
    const optimizationResult = await model.invoke(new HumanMessage(queryOptimizationPrompt));
    const optimizedQueries = optimizationResult.content.toString()
      .split('\n')
      .filter((query: string) => query.trim().length > 0)
      .slice(0, 3); // Ensure we only get max 3 queries

    // Execute SerpAPI search
    console.log("Step 2: Executing searches...");
    const searchTool = new SerpAPI(process.env.SERPER_API_KEY);
    const searchResults = [];
    
    for (const query of optimizedQueries) {
      console.log(`Searching for: ${query}`);
      try {
        const result = await searchTool.invoke(query);
        searchResults.push({
          query,
          result
        });
      } catch (error) {
        console.warn(`Search failed for query "${query}": ${error}`);
      }
    }
    
    if (searchResults.length === 0) {
      throw new Error("All searches failed. Cannot proceed with analysis.");
    }

    // Synthesizing information
    const synthesisPrompt = createSynthesisPrompt(researchPlan, searchResults);
    const synthesisResult = await model.invoke(new HumanMessage(synthesisPrompt));
    const researchBriefing = synthesisResult.content.toString();

    return {
      macroAnalysisResult: researchBriefing,
    };

  } catch (error) {
    console.error(`Error during macroeconomic analysis: ${error instanceof Error ? error.message : String(error)}`);
    return {
      macroAnalysisResult: `Error during analysis: ${error}`,
      nextStep: "handle_error",
    };
  }
  

}
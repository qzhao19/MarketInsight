import {
  HumanMessage,
} from "@langchain/core/messages";
// import { SerpAPI } from "@langchain/community/tools/serpapi";

import { ResearchPlan, MarketResearchState } from "./state"
import { createContextExtractionPrompt, createResearchPlanPrompt } from "./config/prompts";
import { ResearchContextSchema, ResearchPlanSchema } from "./config/schemas"
import { 
  alignStructureMessage,
  createDefaultResearchContext, 
  createDefaultResearchPlan, 
  createMacroAnalysisPrompt,
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
    const errorMsg = "Macro analysis cannot proceed: researchPlan or macroAnalysisParams are missing from the state.";
    console.error(errorMsg);
    return {
      macroAnalysisResult: {
        error: errorMsg,
        content: "Analysis failed due to missing input.",
      }
    };
  }

  try {
    const analysisPrompt = createMacroAnalysisPrompt(researchPlan);
    const response = await model.invoke(new HumanMessage(analysisPrompt));
    const reportContent = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    return {
      macroAnalysisResult: {
        content: reportContent,
      }
    };

  } catch (error) {
    const errorMsg = `Error during Macroeconomic Analysis: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    // Return an error state to be merged
    return {
      macroAnalysisResult: {
        error: errorMsg,
        content: "An error occurred while generating the analysis report.",
      }
    };
  }

}
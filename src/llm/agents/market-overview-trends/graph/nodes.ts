import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Logger } from "@nestjs/common"; 

import { validateAndEnrichResearchContext } from "../../../../utils/llm.utils"
import { ResearchPlan } from "../../../../types/llm/agent.types"
import { MarketResearchState } from "./state"
import { 
  createContextExtractionPrompt, 
  createResearchPlanPrompt,
  createMacroAnalysisPrompt, 
  createMacroSynthesisPrompt,
  createSegmentationSynthesisPrompt,
  createTrendAnalysisPrompt,
  createTrendSynthesisPrompt,
  createSegmentationAnalysisPrompt,
  createSynthesisAnalystPrompt 
} from "./prompts";
import { 
  ResearchContextSchema, 
  ResearchPlanSchema, 
  ResearchQueriesSchema 
} from "./schemas"

// Instantiate logger at the top of the file.
const logger = new Logger('MarketResearchNodes');

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

    researchContext = await structuredContextModel.invoke(
      contextExtractionPrompt
    );

  } catch (error) {
    const errorMsg = `Failed to extract structured context: ${error instanceof Error ? error.message : String(error)}`;
    throw new Error(errorMsg);
  }

  // Verify the integrity of the parsing results
  researchContext = validateAndEnrichResearchContext(researchContext, state.userContext);

  // 2. Create a structured output model for generating research plans
  let detailedPlan;
  try {
    const researchPlanPrompt = createResearchPlanPrompt(researchContext);
    const structuredPlanModel = model.withStructuredOutput(ResearchPlanSchema, {
      name: "ResearchPlanGeneration"
    });
    
    detailedPlan = await structuredPlanModel.invoke(
      researchPlanPrompt
    );
    
  } catch (error) {
    const errorMsg = `Failed to generate structured research plan: ${error instanceof Error ? error.message : String(error)}`;
    throw new Error(errorMsg);
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
    };
};


export async function macroAnalysisTask(
  state: typeof MarketResearchState.State,
  config: any
): Promise<Partial<typeof MarketResearchState.State>> {
  const model = config.configurable.model;
  const serperApiKey = config.configurable.serperApiKey;
  const { researchPlan } = state;

  if (!researchPlan || !researchPlan.macroAnalysisParams) {
    logger.error("Macro analysis cannot proceed: researchPlan or macroAnalysisParams are missing from the state.");
    return {
      macroAnalysisResult: "Error: Missing research plan or macro analysis parameters",
    };
  }

  try {
    // Optimizing search queries
    logger.log("Optimizing search queries for macro analysis.");
    const queryOptimizationPrompt = createMacroAnalysisPrompt(researchPlan);
    // Call withStructuredOutput
    const structuredQueryModel = model.withStructuredOutput(ResearchQueriesSchema, {
      name: "MacroQueryOptimization"
    });
    const optimizedQueryResult = await structuredQueryModel.invoke(
      queryOptimizationPrompt
    );
    const { searchQueries: optimizedQueries } = optimizedQueryResult;

    if (!optimizedQueries || optimizedQueries.length === 0) {
      throw new Error("No valid search queries generated, falling back to default queries");
    }

    // Execute SerpAPI search
    logger.log("Executing parallel searches for macro analysis.");
    const searchTool = new SerpAPI(serperApiKey);
    const searchPromises = optimizedQueries.map(async (query: string) => {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Search timeout for: "${query}"`)), 15000)
        );
        
        const result = await Promise.race([
          searchTool.invoke(query),
          timeoutPromise
        ]);
        return { query, result, success: true as const };
      } catch (error) {
        return { query, error, success: false as const};
      }
    });

    // Wait for all searches to complete
    const results = await Promise.allSettled(searchPromises);

    // Filter successed results
    const successfulSearches = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(item => item.success);
      
    const searchResults = successfulSearches.map(item => ({
      query: item.query,
      result: item.result
    }));

    if (searchResults.length === 0) {
      throw new Error("All searches failed. Cannot proceed with analysis.");
    }

    // Synthesizing information
    const synthesisPrompt = createMacroSynthesisPrompt(researchPlan, searchResults);
    const synthesisResult = await model.invoke(synthesisPrompt);
    const researchBriefing = synthesisResult.content.toString();

    logger.log("Macroeconomic analysis completed successfully.");
    return {
      macroAnalysisResult: researchBriefing,
    };

  } catch (error) {
    logger.error(`Error during macroeconomic analysis: ${error instanceof Error ? error.message : String(error)}`);
    return {
      macroAnalysisResult: `Error during analysis: ${error}`,
    };
  }
}


export async function segmentationAnalysisTask(
  state: typeof MarketResearchState.State,
  config: any
): Promise<Partial<typeof MarketResearchState.State>> {

  // Get LLM model
  const model = config.configurable.model;
  const serperApiKey = config.configurable.serperApiKey;
  const { researchPlan } = state;

  if (!researchPlan || !researchPlan.segmentationAnalysisParams) {
    logger.error("Segmentation analysis cannot proceed: researchPlan or segmentationAnalysisParams are missing from the state.");
    return {
      segmentationAnalysisResult: "Error: Missing research plan or segmentation analysis parameters",
    };
  }

  try {
    logger.log("Optimizing search queries for segmentation analysis.");
    const queryOptimizationPrompt = createSegmentationAnalysisPrompt(researchPlan);
    
    // Call model with withStructuredOutput method
    const structuredQueryModel = model.withStructuredOutput(ResearchQueriesSchema, {
      name: "SegmentationQueryOptimization"
    });
    const optimizedQueryResult = await structuredQueryModel.invoke(
      queryOptimizationPrompt
    );
    const { searchQueries: optimizedQueries } = optimizedQueryResult;

    // Executing parallel searches
    logger.log("Executing parallel searches for segmentation analysis.");
    const searchTool = new SerpAPI(serperApiKey);
    const searchPromises = optimizedQueries.map(async (query: string) => {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Search timeout for: "${query}"`)), 15000)
        );
        
        const result = await Promise.race([
          searchTool.invoke(query),
          timeoutPromise
        ]);
        return { query, result, success: true as const };
      } catch (error) {
        return { query, error, success: false as const};
      }
    });

    const results = await Promise.allSettled(searchPromises);

    const successfulSearches = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(item => item.success);
      
    const searchResults = successfulSearches.map(item => ({
      query: item.query,
      result: item.result
    }));

    if (searchResults.length === 0) {
      throw new Error("All segmentation searches failed. Cannot proceed with analysis.");
    }

    const synthesisPrompt = createSegmentationSynthesisPrompt(researchPlan, searchResults);
    const synthesisResult = await model.invoke(synthesisPrompt);
    const segmentationBriefing = synthesisResult.content.toString();

    logger.log("Segmentation analysis completed successfully.");
    return {
      segmentationAnalysisResult: segmentationBriefing,
    };

  } catch (error) {
    logger.error(`Error during segmentation analysis: ${error instanceof Error ? error.message : String(error)}`);
    return {
      segmentationAnalysisResult: `Error during segmentation analysis: ${error}`,
    };
  }
}

export async function trendAnalysisTask(
  state: typeof MarketResearchState.State,
  config: any
): Promise<Partial<typeof MarketResearchState.State>> {
  // Get LLM model and Serper API key
  const model = config.configurable.model;
  const serperApiKey = config.configurable.serperApiKey;
  const { researchPlan } = state;

  if (!researchPlan || !researchPlan.trendAnalysisParams) {
    logger.error("Market trend analysis cannot proceed: researchPlan or trendAnalysisParams are missing from the state.");
    return {
      trendAnalysisResult: "Error: Missing research plan or market trend analysis parameters",
    };
  }

  try {
    logger.log("Optimizing search queries for trend analysis.");
    const queryOptimizationPrompt = createTrendAnalysisPrompt(researchPlan);
    
    // Call model with withStructuredOutput method
    const structuredQueryModel = model.withStructuredOutput(ResearchQueriesSchema, {
      name: "TrendAnalysisQueryOptimization"
    });
    const optimizedQueryResult = await structuredQueryModel.invoke(
      queryOptimizationPrompt
    );
    const { searchQueries: optimizedQueries } = optimizedQueryResult;
    
    logger.log("Executing parallel searches for trend analysis.");
    const searchTool = new SerpAPI(serperApiKey);
    const searchPromises = optimizedQueries.map(async (query: string) => {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Search timeout for: "${query}"`)), 15000)
        );
        
        const result = await Promise.race([
          searchTool.invoke(query),
          timeoutPromise
        ]);
        return { query, result, success: true as const };
      } catch (error) {
        return { query, error, success: false as const};
      }
    });

    const results = await Promise.allSettled(searchPromises);
    const successfulSearches = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(item => item.success);
      
    const searchResults = successfulSearches.map(item => ({
      query: item.query,
      result: item.result
    }));

    if (searchResults.length === 0) {
      throw new Error("All trend searches failed. Cannot proceed with analysis.");
    }

    const synthesisPrompt = createTrendSynthesisPrompt(researchPlan, searchResults);
    const synthesisResult = await model.invoke(synthesisPrompt);
    const trendBriefing = synthesisResult.content.toString();

    logger.log("Trend analysis completed successfully.");
    return {
      trendAnalysisResult: trendBriefing,
    };

  } catch (error) {
    logger.error(`Error during trend analysis: ${error instanceof Error ? error.message : String(error)}`);
    return {
      trendAnalysisResult: `Error during trend analysis: ${error}`,
    };
  }
}

export async function synthesisAnalystTask(
  state: typeof MarketResearchState.State,
  config: any
): Promise<Partial<typeof MarketResearchState.State>> {

  const model = config.configurable.model;
  const { researchPlan, macroAnalysisResult, segmentationAnalysisResult, trendAnalysisResult } = state;

  // Check necessary inputs 
  if (!researchPlan) {
    logger.error("Report synthesis cannot proceed: Research plan is missing");
    return {
      draftReport: "Error: Missing research plan",
    };
  }

  const isSuccessful = (result: string) => result && !result.startsWith("Error:");
  const availableResults = {
    macro: isSuccessful(macroAnalysisResult),
    segmentation: isSuccessful(segmentationAnalysisResult),
    trend: isSuccessful(trendAnalysisResult),
  };
  const successfulAnalyses = Object.values(availableResults).filter(Boolean).length;

  // Make sure that at least one result is available.
  if (successfulAnalyses === 0) {
    logger.error("Report synthesis cannot proceed: No successful analysis results are available.");
    return {
      draftReport: "Error: No analysis results available for synthesis. Synthesis aborted.",
    };
  }

  try {
    logger.log("Creating final synthesis prompt.");
    const synthesisPrompt = createSynthesisAnalystPrompt(state);
    const synthesisResult = await model.invoke(synthesisPrompt);
    const reportDraft = synthesisResult.content.toString();

    logger.log("Final report draft generated successfully.");
    return {
      draftReport: reportDraft,
    };

  } catch (error) {
    logger.error(`Error during report synthesis: ${error instanceof Error ? error.message : String(error)}`);
    return {
      draftReport: `Error occurred during report synthesis: ${error}`,
    };
  }
}



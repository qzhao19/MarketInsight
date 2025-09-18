import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ResearchParams, ResearchPlan, ResearchState } from "./state"
import { createContextExtractionPrompt, createResearchPlanPrompt } from "./prompts";

function createDefaultResearchContext(userInput: string) {
  return {
    industry: userInput,
    geographicScope: "Global",
    timeFrame: {
      historical: "2019-2023",
      current: "2024",
      forecast: "2025-2030"
    },
    specialFocus: ["Market Growth", "Competitive Landscape"],
    urgency: "medium",
    complexity: "medium"
  };
};

function createDefaultResearchPlan(context: any) {
  return {
    macro: {
      keyQuestions: [
        `What is the market size of the ${context.industry} industry?`,
        "What are the historical growth rate trends?",
        "What are the future market projections?",
        "What stage of development is the market in?",
        "How do macroeconomic factors (e.g., inflation, GDP) impact the industry?",
        "What are the key government policies and regulations affecting the market?"
      ],
      searchQueries: [
        `${context.industry} market size ${context.geographicScope}`,
        `${context.industry} growth rate trends`,
        `${context.industry} market forecast`,
        `${context.industry} macroeconomic factors`,
        `${context.industry} government policies and regulations`
      ],
      priority: "high"
    },
    segmentation: {
      keyQuestions: [
        "What are the primary product segments?",
        "What are the characteristics of different user groups?",
        "What is the geographic distribution?"
      ],
      searchQueries: [
        `${context.industry} market segmentation`,
        `${context.industry} customer segments`,
        `${context.industry} regional analysis`
      ],
      priority: "medium"
    },
    trend: {
      keyQuestions: [
        "What are the emerging technology trends?",
        "How is the policy environment evolving?",
        "What trends are emerging in the supply chain?",
        "What are the major socioeconomic trends (e.g., consumer behavior, demographics) influencing the market?",
        "Who are the key competitors and what are their strategies?"
      ],
      searchQueries: [
        `${context.industry} technology trends`,
        `${context.industry} policy changes`,
        `${context.industry} supply chain trends`,
        `${context.industry} socioeconomic trends`,
        `${context.industry} key competitors and strategies`
      ],
      priority: "medium"
    }
  };
};

function validateAndEnrichContext(parsedContext: any, userContext: any) {
  return {
    industry: parsedContext.industry || userContext.industry || "Not specified",
    geographicScope: parsedContext.geographicScope || userContext.geographicScope || "Global",
    timeFrame: {
      historical: parsedContext.timeFrame?.historical || "2019-2023",
      current: parsedContext.timeFrame?.current || "2024",
      forecast: parsedContext.timeFrame?.forecast || "2025-2030"
    },
    specialFocus: [
      ...(parsedContext.specialFocus || []),
      ...(userContext.specialFocus || [])
    ].filter((item, index, arr) => arr.indexOf(item) === index), // duplicate
    urgency: parsedContext.urgency || "medium",
    complexity: parsedContext.complexity || "medium"
  };
};

/**
 * 
 */
async function planResearchTasks(
  state: typeof ResearchState.State,
  config: any
): Promise<Partial<typeof ResearchState.State>> {
  
  // Use prompt function
  const extractContextPrompt = createContextExtractionPrompt(state.userInput);

  let researchContext;
  const model = config.model;
  const extractContextInput = {
    messages: [new HumanMessage(extractContextPrompt)]
  };
  const extractContextResponse: AIMessage = await model.invoke(extractContextInput);
  
  // Intelligent parse and output a structure json
  try {
    if (typeof extractContextResponse.content !== "string") {
      throw new Error("Expected string content from model, but received a different type.");
    }

    const cleanContextResponse = extractContextResponse.content.replace(/```json\n?|\n?```/g, '').trim();
    researchContext = JSON.parse(cleanContextResponse);
  } catch (error) {
    console.warn("JSON parsing failed; using default configuration.:", error);
    researchContext = createDefaultResearchContext(state.userInput);
  }

  // Verify the integrity of the parsing results
  researchContext = validateAndEnrichContext(researchContext, state.userContext);

  // Generate detailed research plan
  const researchPlanPrompt = createResearchPlanPrompt(researchContext);

  let detailedPlan;
  const researchPlanInput = {
    messages: [new HumanMessage(researchPlanPrompt)]
  };
  const researchPlanInputResponse: AIMessage = await model.invoke(researchPlanInput);
  try {
    if (typeof researchPlanInputResponse.content !== "string") {
      throw new Error("Expected string content from model, but received a different type.");
    }

    const cleanPlanResponse = researchPlanInputResponse.content.replace(/```json\n?|\n?```/g, '').trim();
    detailedPlan = JSON.parse(cleanPlanResponse);
  } catch (error) {
    console.warn("JSON parsing failed; using default configuration.:", error);
    detailedPlan = createDefaultResearchPlan(state.userInput);
  }

  // Create assigned tasks
  const assignedTasks = ['macroAnalysis', 'segmentationAnalysis', 'trendAnalysis'];

  // Create research plan
  const researchPlan: ResearchPlan = {
    ...researchContext,
    macroAnalysisParams: detailedPlan.macro,
    segmentationAnalysisParams: detailedPlan.segmentation,
    trendAnalysisParams: detailedPlan.trend
  };

  return {
      researchPlan,
      assignedTasks,
      userContext: {
        ...state.userContext,
        ...researchContext,
        planningTimestamp: new Date().toISOString()
      },
      nextStep: "execute_parallel_research",
    };
}
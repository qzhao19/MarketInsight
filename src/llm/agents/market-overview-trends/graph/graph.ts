import { END, START, StateGraph } from "@langchain/langgraph";
import {
  planResearchTasks,
  macroAnalysisTask,
  segmentationAnalysisTask,
  trendAnalysisTask,
  synthesisAnalystTask,
} from "./nodes";
import { MarketResearchState } from "./state"


function checkAnalysisCompletion(
  state: typeof MarketResearchState.State
): "synthesize" | "continue" {
  const {
    macroAnalysisResult,
    segmentationAnalysisResult,
    trendAnalysisResult,
  } = state;

  const isMacroSuccessful = macroAnalysisResult.length > 0 && !macroAnalysisResult.startsWith("Error:");
  const isSegmentationSuccessful = segmentationAnalysisResult.length > 0 && !segmentationAnalysisResult.startsWith("Error:");
  const isTrendSuccessful = trendAnalysisResult.length > 0 && !trendAnalysisResult.startsWith("Error:");

  // Check that all three analyses have been completed.
  if (isMacroSuccessful && isSegmentationSuccessful && isTrendSuccessful) {
    return "synthesize";
  }
  return "continue";
}

// Build graph
const MarketOverviewGraph = new StateGraph(MarketResearchState)
  // Add all nodes
  .addNode("planResearch", planResearchTasks)
  .addNode("macroAnalysis", macroAnalysisTask)
  .addNode("segmentationAnalysis", segmentationAnalysisTask)
  .addNode("trendAnalysis", trendAnalysisTask)
  .addNode("synthesisAnalyst", synthesisAnalystTask);

MarketOverviewGraph.addEdge(START, "planResearch");

// Three parallel tasks
MarketOverviewGraph.addEdge("planResearch", "macroAnalysis");
MarketOverviewGraph.addEdge("planResearch", "segmentationAnalysis");
MarketOverviewGraph.addEdge("planResearch", "trendAnalysis");

// Add conditional edges for three analysis tasks: 
// Check if all tasks are completed; if completed, proceed to the synthesis step.
MarketOverviewGraph.addConditionalEdges(
  "macroAnalysis",
  checkAnalysisCompletion,
  {
    synthesize: "synthesisAnalyst",
    continue: "macroAnalysis"
  }
);
MarketOverviewGraph.addConditionalEdges(
  "segmentationAnalysis",
  checkAnalysisCompletion,
  {
    synthesize: "synthesisAnalyst",
    continue: "segmentationAnalysis"
  }
);
MarketOverviewGraph.addConditionalEdges(
  "trendAnalysis",
  checkAnalysisCompletion,
  {
    synthesize: "synthesisAnalyst",
    continue: "trendAnalysis"
  }
);
MarketOverviewGraph.addEdge("synthesisAnalyst", END);

export { MarketOverviewGraph };
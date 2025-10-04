import { END, START, StateGraph } from "@langchain/langgraph";
import {
  planResearchTasks,
  macroAnalysisTask,
  segmentationAnalysisTask,
  trendAnalysisTask,
  synthesisAnalystTask,
} from "./nodes";
import { MarketResearchState } from "./state"

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

// LangGraph will automatically wait for all parallel branches to complete.
MarketOverviewGraph.addEdge("macroAnalysis", "synthesisAnalyst");
MarketOverviewGraph.addEdge("segmentationAnalysis", "synthesisAnalyst");
MarketOverviewGraph.addEdge("trendAnalysis", "synthesisAnalyst");

// Finish after synthesis completes
MarketOverviewGraph.addEdge("synthesisAnalyst", END);

export { MarketOverviewGraph };
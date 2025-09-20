import { END, START, StateGraph } from "@langchain/langgraph";
import { planResearchTasks } from "./nodes/planning"
import { MarketResearchState } from "./state"

// Build graph
const MarketTrendsGraph = new StateGraph(MarketResearchState)
  .addNode("planResearch", planResearchTasks);

MarketTrendsGraph.addEdge(START, "planResearch")
MarketTrendsGraph.addEdge("planResearch", END);

export { MarketTrendsGraph };
import { Annotation } from "@langchain/langgraph";

export type AnyRecord = Record<string, any>;

export interface ResearchParams {
  keyQuestions: string[];
  searchQueries: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ResearchPlan {
  industry: string;
  geographicScope: string;
  timeFrame: {
    historical: string;
    current: string;
    forecast: string;
  };
  specialFocus: string[];
  macroAnalysisParams: ResearchParams;
  segmentationAnalysisParams: ResearchParams;
  trendAnalysisParams: ResearchParams;
}

export const MarketResearchState = Annotation.Root({
    
  /**
   * The original user input from user
   */
  userInput: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),

  // The user context stores additional metadata or parameters about the user or session.
  userContext: Annotation<AnyRecord>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  /**
   * The research plan for the project, including industry, scope, timeframe, and analysis parameters.
   */
  researchPlan: Annotation<ResearchPlan | null>({
    reducer: (x, y) => y ?? x,
    default: () => null
  }),

  /**
   * The result of the macro-level market analysis, such as market size, growth rate, forecasts, and stage.
   * This is now a string containing the synthesized research briefing.
   */
  macroAnalysisResult: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),

  /**
   * The result of the market segmentation analysis, including breakdowns by product type, user group, or region.
   */
  segmentationAnalysisResult: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),

  /**
   * The result of the industry trends analysis, covering technology, policy, socioeconomic, and supply chain trends.
   */
  trendAnalysisResult: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),

  /**
   * The draft version of the market analysis report, compiled from the results of all research tasks.
   */
  draftReport: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
});
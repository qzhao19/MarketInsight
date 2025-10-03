import { ResearchPlan, MarketResearchState } from "./state";

/**
 * Creates a prompt to extract structured context from the user's initial input.
 * @param userInput The raw input string from the user.
 * @returns A formatted prompt string for the LLM.
 */
export function createContextExtractionPrompt(userInput: string): string {
  return `
    As a market research expert, analyze the following research requirement and extract key information about the target market.

    User Requirement: "${userInput}"

    Extract the following information:
    - The specific industry or product being researched
    - The geographic scope of the analysis (global, regional, or country-specific)
    - Relevant timeframes (historical period, current year, and forecast period)
    - Any special focus points or aspects of particular interest
    - The apparent urgency level of the request (high, medium, or low)
    - The complexity level of the analysis needed (high, medium, or low)

    Your extraction should be comprehensive yet precise, inferring information where not explicitly stated using industry best practices.
  `;
}

/**
 * Creates a prompt to generate a detailed research plan based on the extracted context.
 * @param researchContext The structured context containing industry, scope, timeframe, etc.
 * @returns A formatted prompt string for the LLM.
 */
export function createResearchPlanPrompt(researchContext: any): string {
  return `As the Head of Market Research, develop a detailed research plan for the ${researchContext.industry} sector.
    Research Scope: ${researchContext.geographicScope}
    Time Frame: ${researchContext.timeFrame.historical} → ${researchContext.timeFrame.current} → ${researchContext.timeFrame.forecast}
    
    CRITICAL INSTRUCTIONS:
    You MUST return ONLY a valid JSON object with EXACTLY these three keys: "macro", "segmentation", and "trend".
    DO NOT include any explanatory text or analysis outside the JSON object.
    DO NOT include fields like "industry", "geographicScope", "timeFrame" or other metadata.
    
    Required JSON format:
    {
      "macro": {
        "keyQuestions": ["Question1", "Question2", ...],
        "searchQueries": ["Query1", "Query2", ...],
        "priority": "high|medium|low"
      },
      "segmentation": {
        "keyQuestions": ["Question1", "Question2", ...],
        "searchQueries": ["Query1", "Query2", ...],
        "priority": "high|medium|low"
      },
      "trend": {
        "keyQuestions": ["Question1", "Question2", ...],
        "searchQueries": ["Query1", "Query2", ...],
        "priority": "high|medium|low"
      }
    }
    
    For each section:
    - Include 3-5 specific research questions
    - Include 3-5 search queries that would provide answers
    - Assign a priority level (high/medium/low)
  `;
}

export function createMacroAnalysisPrompt(researchPlan: ResearchPlan): string {
  const { industry, geographicScope, timeFrame, macroAnalysisParams } = researchPlan;

  return `
    You are a search optimization expert specializing in macroeconomic market research.
    
    **Research Context:**
    - **Industry/Product:** ${industry}
    - **Geographic Scope:** ${geographicScope}
    - **Time Frame:** ${timeFrame.historical} to ${timeFrame.forecast}, current year ${timeFrame.current}
    
    **Key Research Questions:**
    ${macroAnalysisParams.keyQuestions.map(q => `- ${q}`).join('\n')}
    
    **Initial Search Queries:**
    ${macroAnalysisParams.searchQueries.map(q => `- ${q}`).join('\n')}
    
    **Your Task:**
    Analyze the research questions and initial queries, then provide:

    1. The most important key questions (3-5) that should be prioritized
    2. Exactly 3 highly optimized search queries that will yield the best market research results
    3. A priority level (high, medium, or low) for this research area

    When creating your optimized queries:
    - Make them specific and targeted
    - Include relevant industry terminology
    - Incorporate geographic scope when appropriate
    - Add time parameters where relevant
    - Ensure all queries together cover the most critical information needs
  `;
}

type SearchResultItem = {
  query: string;
  result: string;
};

export function createMacroSynthesisPrompt(
  researchPlan: ResearchPlan,
  searchResults: SearchResultItem[]
): string {
  const { industry, macroAnalysisParams } = researchPlan;

  return `
    You are a market research analyst specializing in ${industry}.
    Based on the following search results, create a comprehensive research briefing that addresses these key questions:
    ${macroAnalysisParams.keyQuestions.join("\n- ")}
    
    Search Results:
    ${searchResults.map(item => 
      `--- Query: ${item.query} ---\n${item.result}\n`
    ).join("\n\n")}
    
    Create a well-structured, fact-based research briefing with relevant data, trends, and insights.
  `;
}

export function createSegmentationAnalysisPrompt(researchPlan: ResearchPlan): string {
  const { industry, geographicScope, timeFrame, segmentationAnalysisParams } = researchPlan;
  
  return `
    You are a search optimization expert specializing in market segmentation research.
    
    **Research Context:**
    - **Industry/Product:** ${industry}
    - **Geographic Scope:** ${geographicScope}
    - **Time Frame:** ${timeFrame.historical} to ${timeFrame.forecast}, current year ${timeFrame.current}
    
    **Key Research Questions:**
    ${segmentationAnalysisParams.keyQuestions.map(q => `- ${q}`).join('\n')}
    
    **Initial Search Queries:**
    ${segmentationAnalysisParams.searchQueries.map(q => `- ${q}`).join('\n')}
    
    **Your Task:**
    Analyze the segmentation questions and initial queries, then provide:

    1. The most important key questions (3-5) about market segmentation that should be prioritized
    2. Exactly 3 highly optimized search queries that will yield the best segmentation insights
    3. A priority level (high, medium, or low) for this research area

    When creating your optimized segmentation queries:
    - Focus on customer segments, product categories, and market divisions
    - Include industry-specific terminology for segments
    - Incorporate geographic market segments when appropriate
    - Target information about segment sizes, growth rates, and characteristics
    - Ensure the queries together provide comprehensive segmentation coverage
  `;
}

export function createSegmentationSynthesisPrompt(
  researchPlan: ResearchPlan,
  searchResults: SearchResultItem[]
): string {
  const { industry, segmentationAnalysisParams } = researchPlan;
  return `
    You are a market segmentation expert specializing in ${industry}.
    Based on the following search results, create a comprehensive segmentation analysis that addresses these key questions:
    ${segmentationAnalysisParams.keyQuestions.join("\n- ")}
    
    Search Results:
    ${searchResults.map(item => 
      `--- Query: ${item.query} ---\n${item.result}\n`
    ).join("\n\n")}
    
    Create a well-structured, fact-based segmentation analysis with:
    1. Clear identification of major market segments (by product type, customer type, geography, etc.)
    2. Estimated size and growth of each segment
    3. Key characteristics and needs of each segment
    4. Competitive landscape within each important segment
    5. Most profitable or fastest growing segments
    
    Present your analysis as a coherent report with headings and well-organized sections.
  `;
}

export function createTrendAnalysisPrompt(researchPlan: ResearchPlan): string {
  const { industry, geographicScope, timeFrame, trendAnalysisParams } = researchPlan;
  
  return `
    You are a search optimization expert specializing in market trends research.
    
    **Research Context:**
    - **Industry/Product:** ${industry}
    - **Geographic Scope:** ${geographicScope}
    - **Time Frame:** ${timeFrame.historical} to ${timeFrame.forecast}, current year ${timeFrame.current}
    
    **Key Research Questions:**
    ${trendAnalysisParams.keyQuestions.map(q => `- ${q}`).join('\n')}
    
    **Initial Search Queries:**
    ${trendAnalysisParams.searchQueries.map(q => `- ${q}`).join('\n')}
    
    **Your Task:**
    Analyze the trend-related questions and initial queries, then provide:

    1. The most important key questions (3-5) about market trends that should be prioritized
    2. Exactly 3 highly optimized search queries that will yield the best trend insights
    3. A priority level (high, medium, or low) for this research area

    When creating your optimized trend queries:
    - Focus on emerging technologies, changing consumer behaviors, and future developments
    - Include timeframe indicators (e.g., "emerging", "future", "${timeFrame.forecast}")
    - Use specific industry terminology related to innovation and change
    - Target information about growth trajectories and market evolution
    - Ensure the queries together capture the most important trend information
  `;
}

export function createTrendSynthesisPrompt(
  researchPlan: ResearchPlan,
  searchResults: SearchResultItem[]
): string {
  const { industry, trendAnalysisParams } = researchPlan;
  return `
    You are a market trend analyst specializing in ${industry}.
    Based on the following search results, create a comprehensive trend analysis that addresses these key questions:
    ${trendAnalysisParams.keyQuestions.join("\n- ")}
    
    Search Results:
    ${searchResults.map(item => 
      `--- Query: ${item.query} ---\n${item.result}\n`
    ).join("\n\n")}
    
    Create a well-structured, fact-based trend analysis with:
    1. Major emerging trends in the ${industry} market
    2. Technological innovations driving market evolution
    3. Changing consumer preferences and behaviors
    4. Regulatory changes impacting the market
    5. Predictions for the next ${researchPlan.timeFrame.forecast.replace(/\D/g, "")} years
    
    For each identified trend:
    - Explain its current status and significance
    - Provide evidence and data points from the search results
    - Discuss its potential impact on the market
    - Identify key players leading or benefiting from the trend
    
    Present your analysis as a coherent report with headings and well-organized sections.
  `;
}


export function createSynthesisAnalystPrompt(
  state: typeof MarketResearchState.State
): string {
  const { macroAnalysisResult, segmentationAnalysisResult, trendAnalysisResult, researchPlan } = state;

  return `
    You are a senior market research analyst tasked with synthesizing separate analysis reports into a comprehensive market research report draft.

    ## Research Context
    - Industry: ${researchPlan?.industry ?? "N/A"}
    - Geographic Scope: ${researchPlan?.geographicScope ?? "N/A"}
    - Time Period: ${researchPlan?.timeFrame?.historical ?? "N/A"} (historical) to ${researchPlan?.timeFrame?.forecast ?? "N/A"} (forecast)
    - Current Year: ${researchPlan?.timeFrame?.current ?? "N/A"}
    - Special Focus Areas: ${researchPlan?.specialFocus?.join(", ") ?? "N/A"}

    ## Individual Analysis Reports

    ### 1. MACROECONOMIC ANALYSIS
    ${macroAnalysisResult || "Macroeconomic analysis data unavailable."}

    ### 2. MARKET SEGMENTATION ANALYSIS
    ${segmentationAnalysisResult || "Market segmentation analysis data unavailable."}

    ### 3. MARKET TRENDS ANALYSIS
    ${trendAnalysisResult || "Market trends analysis data unavailable."}

    ## Your Task
    Create a cohesive, well-structured market research report draft that integrates all the analysis above. The report should follow this structure:

    1. Executive Summary
    2. Introduction
        - Industry Background
        - Research Scope & Methodology
    3. Market Overview
        - Market Size & Growth
        - Key Economic Indicators
        - Market Dynamics (Drivers & Constraints)
    4. Market Segmentation
        - Primary Segments & Their Characteristics
        - Key Players in Each Segment
        - Segment Growth Comparison
    5. Market Trends & Future Outlook
        - Key Technological Trends
        - Consumer Behavior Trends
        - Regulatory Trends
        - Growth Forecasts
    6. Conclusion

    Ensure your report is fact-based, well-organized, and professionally written. Eliminate redundancies between sections and ensure a logical flow of information.
  `;
}

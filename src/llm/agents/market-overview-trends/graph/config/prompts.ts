import { ResearchPlan } from "../state";

/**
 * Creates a prompt to extract structured context from the user's initial input.
 * @param userInput The raw input string from the user.
 * @returns A formatted prompt string for the LLM.
 */
export function createContextExtractionPrompt(userInput: string): string {
  return `
    You are a seasoned market research expert. Please analyze the following market research requirements and extract key information.

    User Requirement: "${userInput}"

    Strictly return information in the following JSON format WITHOUT adding extra text:
    {
      "industry": "Target industry/product name",
      "geographicScope": "Geographic scope (e.g., Global, China, North America)",
      "timeFrame": {
        "historical": "Historical analysis time period",
        "current": "Current base year",
        "forecast": "Forecast timeframe"
      },
      "specialFocus": ["Special focus points"],
      "urgency": "high|medium|low",
      "complexity": "high|medium|low"
    }
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
    
    Generate specific research parameters for each research direction and return them in JSON format:
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
        "keyQuestions": ["Question 1", "Question 2", ...],
        "searchQueries": ["Query 1", "Query 2", ...],
        "priority": "high|medium|low"
      }
    }
  `;
}

export function createMacroAnalysisPrompt(researchPlan: ResearchPlan): string {
  const { industry, geographicScope, timeFrame, macroAnalysisParams } = researchPlan;

  return `
    You are a search optimization expert specializing in market research.
    
    **Research Context:**
    - **Industry/Product:** ${industry}
    - **Geographic Scope:** ${geographicScope}
    - **Time Frame:** ${timeFrame.historical} to ${timeFrame.forecast}, current year ${timeFrame.current}
    
    **Key Research Questions:**
    ${macroAnalysisParams.keyQuestions.map(q => `- ${q}`).join('\n')}
    
    **Initial Search Queries:**
    ${macroAnalysisParams.searchQueries.map(q => `- ${q}`).join('\n')}
    
    **Task:**
    Consolidate and optimize these initial queries into 2-3 highly effective search queries that will:
    1. Cover all key research questions
    2. Minimize redundancy across searches
    3. Use specific industry terminology for better results
    4. Include geographic scope and relevant timeframes where appropriate
    
    **Output Format:**
    Return ONLY the optimized search queries, exactly one per line, with no explanations, labels, or additional text.
  `;
}

type SearchResultItem = {
  query: string;
  result: string;
};

export function createSynthesisPrompt(
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



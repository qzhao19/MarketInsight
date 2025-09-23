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
    You are a senior market analyst. Your task is to conduct a macroeconomic analysis based on the provided research plan.

    **Research Context:**
    - **Industry/Product:** ${industry}
    - **Geographic Scope:** ${geographicScope}
    - **Time Frame:** Analyze from ${timeFrame.historical} to ${timeFrame.forecast}, with a focus on the current year (${timeFrame.current}).

    **Macroeconomic Research Parameters:**
    - **Key Questions to Address:**
      - ${macroAnalysisParams.keyQuestions.join('\n  - ')}
    - **Suggested Search Angles (for your internal reference):**
      - ${macroAnalysisParams.searchQueries.join('\n  - ')}
    - **Priority:** ${macroAnalysisParams.priority}

    **Your Task:**
    Generate a concise but comprehensive macroeconomic analysis report. 
    The report should directly address the key questions listed above. 
    Structure your report with clear headings and provide data-driven insights where possible.
  `;
}
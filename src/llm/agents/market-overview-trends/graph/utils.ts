export function alignStructureMessage<T>(
  result: any, logPrefix: string = "data"
): T {

  if (typeof result === "object" && "content" in result) {
    try {
      const parsed = JSON.parse(result.content as string);
      console.log(`Successfully parsed ${logPrefix} AIMessage content as JSON`);
      return parsed as T;
    } catch (error) {
      console.warn(`Failed to parse ${logPrefix} AIMessage content as JSON:`, error);
      throw new Error(`Failed to parse structured ${logPrefix}: ${result.content}`);
    } 
  } else {
    console.log(`Successfully received structured ${logPrefix}`);
    return result as T;
  }
}

export function createDefaultResearchContext(userInput: string) {
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

export function createDefaultResearchPlan(context: any) {
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

export function validateAndEnrichContext(parsedContext: any, userContext: any) {
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

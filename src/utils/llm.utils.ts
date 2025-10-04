import { SearchResultItem } from "../types/llm.types"

export function validateAndEnrichResearchContext(parsedContext: any, userContext: any) {
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

export function formatSearchResults(
  searchResults: SearchResultItem[]
): Array<{query: string, result: string}> {
  return searchResults.map(item => {
    let resultText: string;
    try {
      const parsed = JSON.parse(item.result);
      if (Array.isArray(parsed)) {
        resultText = parsed.join('\n');
      } else {
        resultText = String(parsed);
      }
    } catch {
      // If parsing fails, use the original string
      resultText = item.result;
    }
    return { query: item.query, result: resultText };
  });
}

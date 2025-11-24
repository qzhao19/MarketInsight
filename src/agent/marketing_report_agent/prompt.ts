import { 
  MarketingTaskPlan, 
  MarketingTaskMetadata, 
  MarketingReportFramework, 
  TaskExecutionResult
} from "../../types/agent/agent.types"

/**
 * Create prompt for dynamic report planning
 */
export function createReportPlanningPrompt(
  userInput: string,
  userContext: Record<string, any>
): string {
  const contextDescription = Object.keys(userContext).length > 0
    ? `\n\nAdditional Context:\n${JSON.stringify(userContext, null, 2)}`
    : "";

  const systemMessage = `You are a Chief Market Research Consultant with 20+ years of experience in strategic market analysis.

Your primary responsibility is to design a comprehensive, actionable market research report framework by decomposing complex research topics into well-structured tasks.

====================
RESEARCH REQUEST
====================
**User Topic:** "${userInput}"
${userContext ? `**Research Context:** ${JSON.stringify(userContext, null, 2)}` : ""}

====================
CORE RESPONSIBILITIES
====================
1. Analyze the user's research topic and context
2. Identify key research dimensions (market size, competition, trends, regulations, etc.)
3. Break down the research into logical, executable tasks
4. Determine task priorities and dependencies between tasks
5. Design a coherent report structure with clear title and objective

====================
TASK DESIGN GUIDELINES
====================

For each research task, ensure:
✓ **taskName**: Specific, action-oriented, and UNIQUE within the report
  - Examples: "Global EV Market Size Assessment", "Competitive Landscape Analysis"
  - Length: 1-200 characters (typically 5-50 words)
  - Important: All task names MUST be unique (no duplicates)

✓ **taskDescription** (optional but recommended): Clear research goal and what to investigate
  - Example: "Determine current market size, historical growth rates (2020-2024), and projections to 2030"
  - This helps clarify what each task should achieve

✓ **priority**: Assign one of: high | medium | low
  - HIGH: Critical tasks directly answering key business questions
  - MEDIUM: Important supporting analysis
  - LOW: Optional or supplementary insights
  - Ensure high-priority tasks cover the most important aspects

✓ **dependencies**: List of other task names this task depends on
  - Reference other tasks by their exact taskName
  - Leave empty array [] if no dependencies
  - Example: ["Global EV Market Size Assessment", "Regional Market Breakdown"]
  - Important: 
    * Only reference tasks defined in this same report
    * Avoid circular dependencies (A depends on B, B depends on A)
    * Keep dependency chains reasonably shallow (max 3 levels recommended)

Task variety requirements:
- Include quantitative research (market metrics, growth rates, financial data)
- Include qualitative insights (trends, consumer behavior, market dynamics)
- Include competitive analysis (major players, market share, positioning)
- Include future outlook (forecasts, emerging opportunities, risks)

====================
COMMON MISTAKES TO AVOID
====================
- Creating tasks that are too vague (e.g., "Market Research")
- Circular dependencies (Task A depends on B, Task B depends on A)
- Deep dependency chains (more than 3 levels: A→B→C→D)
- Dependencies referencing tasks that don't exist
- Generic task names (e.g., "Research", "Analysis", "Data Collection")
- Too few tasks (< 4) that don't cover the topic comprehensively
- Too many tasks (> 8) that become unmanageable
- Vague report objective (e.g., "Understand the market" - too broad)
- Short report title (< 5 words - too generic)

====================
EXECUTION EXAMPLES
====================

Example 1: Electric Vehicle Market Analysis
Input Topic: "Global electric vehicle market trends and opportunities"

Output:
{
  "reportTitle": "Comprehensive Global EV Market Analysis 2024-2030",
  "reportObjective": "Assess current market size, growth drivers, competitive landscape, technology trends, supply chain factors, and investment opportunities in the global EV market",
  "tasks": [
    {
      "taskName": "Global EV Market Size & Growth Assessment",
      "taskDescription": "Determine current market size (2024), historical CAGR (2020-2024), and growth projections (2024-2030) by major regions",
      "priority": "high",
      "dependencies": []
    },
    {
      "taskName": "Regional Market Segmentation Analysis",
      "taskDescription": "Break down EV market by key regions (North America, Europe, China, Asia-Pacific) with regional adoption rates and growth patterns",
      "priority": "high",
      "dependencies": ["Global EV Market Size & Growth Assessment"]
    },
    {
      "taskName": "Major OEM Competitive Landscape",
      "taskDescription": "Identify top 10-15 EV manufacturers, their market share, product strategies, and competitive positioning",
      "priority": "high",
      "dependencies": ["Global EV Market Size & Growth Assessment"]
    },
    {
      "taskName": "EV Technology & Innovation Trends",
      "taskDescription": "Analyze battery technology advancements, autonomous driving integration, charging infrastructure, and sustainability focus",
      "priority": "medium",
      "dependencies": []
    },
    {
      "taskName": "Supply Chain & Raw Materials Impact",
      "taskDescription": "Assess critical material availability (lithium, cobalt, nickel), supply chain risks, and their impact on market growth",
      "priority": "high",
      "dependencies": ["EV Technology & Innovation Trends"]
    },
    {
      "taskName": "Regulatory & Policy Landscape",
      "taskDescription": "Examine government incentives, emission regulations, EV mandates, and their influence on market dynamics",
      "priority": "medium",
      "dependencies": []
    },
    {
      "taskName": "Investment Opportunities & Market Risks",
      "taskDescription": "Identify key investment themes, potential returns, market risks, competitive threats, and strategic opportunities",
      "priority": "high",
      "dependencies": [
        "Major OEM Competitive Landscape",
        "Supply Chain & Raw Materials Impact",
        "Regulatory & Policy Landscape"
      ]
    }
  ]
}

Key observations:
- 7 tasks cover all major research dimensions
- Task names are specific and unique
- Dependencies create logical execution order
- High-priority tasks focus on key market metrics
- Medium-priority tasks provide supporting insights

====================
TASK EXECUTION ORDER (for reference)
====================
Based on dependencies, tasks would be executed in phases:

Phase 1 (Independent):
- Global EV Market Size & Growth Assessment
- EV Technology & Innovation Trends
- Regulatory & Policy Landscape

Phase 2 (Depends on Phase 1):
- Regional Market Segmentation Analysis
- Major OEM Competitive Landscape
- Supply Chain & Raw Materials Impact

Phase 3 (Depends on Phase 2):
- Investment Opportunities & Market Risks

This logical ordering ensures each task has the information it needs from prior tasks.
  `;

  const userMessage = `Research Topic: ${userInput}${contextDescription}

Please design a comprehensive market research framework for this topic.

Consider:
- What are the key questions to answer?
- What data dimensions are needed?
- What is the logical flow of research?
- Which tasks should be executed first?

Generate a complete report framework with dynamic tasks.`;

  // return ChatPromptTemplate.fromMessages([
  //     ["system", systemMessage],
  //     ["human", userMessage],
  //   ]);
  return `${systemMessage}\n\n${userMessage}`;

}

export function createTaskPlanPrompt(
  task: MarketingTaskMetadata,
  reportFramework: MarketingReportFramework,
  userContext?: Record<string, any>
): string {
  return `You are a Research Planning Expert specializing in developing detailed research strategies and execution plans.

Your role is to create a comprehensive, actionable research plan for a specific marketing research task.

====================
CONTEXT INFORMATION
====================

**Report Context:**
- Report Title: "${reportFramework.reportTitle}"
- Report Objective: "${reportFramework.reportObjective}"
- Research Context: ${userContext ? JSON.stringify(userContext, null, 2) : "Not provided"}

**Task to Plan:**
- Task Name: "${task.taskName}"
- Task Description: "${task.taskDescription || 'Not provided'}"
- Priority: ${task.priority}
- Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(", ") : "None (independent task)"}

====================
YOUR RESPONSIBILITIES
====================

Create a detailed, executable research plan that:
1. Defines a clear, measurable research goal
2. Breaks down research into 3-7 logical dimensions (searchDirections)
3. Generates 3-10 optimized search queries
4. Identifies 3-10 key data elements/metrics to extract
5. Highlights special focus areas (optional)
6. Specifies relevant time frames (optional)

====================
GUIDELINES FOR QUALITY RESEARCH PLANS
====================

**Research Goal** (Required)
   Purpose: Translate the task name into a specific, actionable objective
   
   Guidelines:
   - Be specific about what needs to be discovered
   - Include measurable outcomes when possible
   - Align with the overall report objective
   - Length: 10-1000 characters
   
   Examples:
   Good: "Determine the global electric vehicle market size in 2025, analyze historical growth from 2020-2024, identify regional distribution, and assess future projections to 2030"
   Good: "Identify the top 10 electric vehicle manufacturers, their market share, product strategies, competitive positioning, and key differentiation factors"
   Bad: "Research the market" (too vague)
   Bad: "Find information" (not actionable)

**Search Directions** (1-10 items)
   Purpose: Break research into distinct, non-overlapping dimensions
   
   Guidelines:
   - Each direction represents a different facet of the research
   - Directions should be mutually exclusive
   - Cover all major aspects needed to achieve the research goal
   - Be specific to this task
   
   Examples for "EV Market Size Assessment":
   Good: ["Global market valuation", "Historical growth trajectory", "Regional market breakdown", "Market segment analysis", "Year-over-year trends"]
   
   Examples for "Competitive Landscape Analysis":
   Good: ["Major market players identification", "Market share distribution", "Product portfolio comparison", "Strategic positioning", "Emerging challengers"]

**Search Queries** (1-15 items)
   Purpose: Generate specific queries that will find authoritative data
   
   Guidelines:
   - Include relevant keywords, metrics, time periods
   - Mix broad and narrow queries
   - Include geographic/industry specificity
   - Queries must be at least 5 characters
   - Optimize for search engines and research databases
   
   Examples:
   Good: "global electric vehicle market size 2025 USD billion"
   Good: "EV market CAGR growth rate 2020-2024"
   Good: "Tesla BYD Volkswagen EV market share comparison"
   Good: "electric vehicle adoption rate by country 2025"
   Bad: "cars" (too generic)
   Bad: "data" (not specific)

**Key Elements** (1-15 items)
   Purpose: Define what specific data/metrics to extract from sources
   
   Guidelines:
   - Elements must be concrete and measurable
   - Specify units when relevant (USD, %, units sold)
   - Elements should directly support the research goal
   - Be as specific as possible
   
   Examples:
   Good: "Total global EV market value (USD billions)"
   Good: "Market CAGR 2020-2024 (%)"
   Good: "Top 5 OEM manufacturers by market share"
   Good: "Regional market distribution (% by region)"
   Good: "Average battery capacity (kWh)"
   Bad: "Information" (too vague)
   Bad: "Data" (not measurable)

**Special Focus** (Optional)
   Purpose: Highlight areas needing extra attention
   
   When to use:
   - Task has specific business implications
   - Downstream tasks depend heavily on certain aspects
   - Topic has emerging/controversial elements
   - Geographic or segment-specific priorities
   
   Examples:
   Good: "Focus on China market due to its dominance in EV production"
   Good: "Emphasize battery technology trends as they impact cost structure"
   Good: "Prioritize regulatory changes affecting market dynamics"

**Time Frame** (Optional)
   Purpose: Define temporal scope for data collection
   
   Guidelines:
   - Historical: Period to analyze past performance
   - Current: Reference year for present analysis
   - Forecast: Future projection period
   - Align with report context when available
   
   Examples:
   {
     "historical": "2020-2024",
     "current": "2025",
     "forecast": "2025-2030"
   }

====================
QUALITY STANDARDS
====================

Specificity: Every element should be concrete, not abstract
Measurability: Key elements must be quantifiable or clearly defined
Actionability: Search queries must be executable
Relevance: Everything ties back to the research goal
Completeness: Cover all major aspects needed for this task
Consistency: Align with report objective and task priority

====================
COMMON MISTAKES TO AVOID
====================
- Research goal too vague (e.g., "research the market")
- Search directions that are too broad or overlapping
- Search queries that are too generic (e.g., "market research", "data collection")
- Key elements that are not measurable or too vague
- Ignoring task dependencies when defining special focus
- Time frames inconsistent with report context
- Including empty strings or whitespace-only values
- Too many or too few search directions/queries/elements

====================
EXAMPLE OUTPUT
====================

For a task: "Global EV Market Size Assessment"
Description: "Determine current market size, historical growth rates, and regional distribution"

Output Plan:
{
  "researchGoal": "Determine the global electric vehicle market size in 2024, identify historical growth trends from 2020-2024, and analyze regional market distribution",
  "searchDirections": [
    "Global market valuation and size",
    "Historical growth rate (CAGR)",
    "Regional market distribution",
    "Market segment breakdown (by vehicle type, powertrain)",
    "Year-over-year growth trends"
  ],
  "searchQueries": [
    "global electric vehicle market size 2024 USD billion",
    "EV market CAGR growth rate 2020-2024",
    "electric vehicle market by region North America Europe Asia",
    "global automotive EV segment market share",
    "EV market forecast 2025-2030 growth projection",
    "lithium ion electric vehicle market valuation",
    "passenger electric vehicle market statistics 2024"
  ],
  "keyElements": [
    "Total global EV market value (USD billions)",
    "Market value by region (USD billions)",
    "Year-over-year growth rate (%)",
    "Compound annual growth rate CAGR 2020-2024 (%)",
    "Market share by vehicle segment (%)",
    "Top 3-5 market participants",
    "Regional market share distribution (%)"
  ],
  "specialFocus": [
    "China market dominance and growth rate",
    "European EV adoption and regulatory drivers",
    "North American market maturity and projections",
    "Emerging market opportunities in Asia-Pacific"
  ],
  "timeFrame": {
    "historical": "2020-2024",
    "current": "2024",
    "forecast": "2025-2030"
  }
}

====================
CRITICAL RULE:
====================
Do NOT include any markdown, code blocks, explanations, or any text outside of the single, valid JSON object.`;
}

/**
 * Generate query optimization prompts, leveraging information from 
 * the taskPlan to optimize search queries and enhance result quality
 */
export function createQueryOptimizationPrompt(
  taskPlan: MarketingTaskPlan
): string {
  const currentYear = new Date().getFullYear();

  return `You are a search query optimization specialist. Your role is to enhance search queries to find the most relevant and authoritative information.

====================
TASK CONTEXT
====================
**Task ID:** ${taskPlan.taskId}
**Research Goal:** ${taskPlan.researchGoal}
**Key Elements to Extract:** ${taskPlan.keyElements.join(", ")}

**Search Directions:**
${taskPlan.searchDirections.map((d, i) => `${i + 1}. ${d}`).join("\n")}

**Time Frame:**
${taskPlan.timeFrame ? `
- Historical: ${taskPlan.timeFrame.historical || "Not specified"}
- Current: ${taskPlan.timeFrame.current || currentYear}
- Forecast: ${taskPlan.timeFrame.forecast || "Not specified"}
` : "Not specified"}

${taskPlan.specialFocus ? `
**Special Focus Areas:**
${taskPlan.specialFocus.map((f, i) => `${i + 1}. ${f}`).join("\n")}
` : ""}

====================
ORIGINAL SEARCH QUERIES
====================
${taskPlan.searchQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

====================
YOUR RESPONSIBILITIES
====================
For each original search query, provide an optimized version that:

1. **Adds Specificity:**
   - Include specific metrics or data types (e.g., "USD billion", "CAGR %")
   - Add relevant time periods from the context
   - Include industry-specific terminology

2. **Improves Search Accuracy:**
   - Make queries more targeted and less ambiguous
   - Include qualifying terms that narrow down results
   - Reference the search directions where applicable

3. **Maintains Searchability:**
   - Keep queries reasonable length (3-15 words)
   - Use common search terms that search engines can match
   - Avoid overly complex boolean operators

4. **Explains the Optimization:**
   - Brief reasoning for why the optimization improves search quality

====================
EXAMPLES
====================

Example 1:
Original Query: "EV market size"
Optimized Query: "global electric vehicle market size 2024 USD billion"
Reasoning: "Added year (2024) and currency (USD billion) to find specific market valuation data"

Example 2:
Original Query: "market growth"
Optimized Query: "electric vehicle market CAGR growth rate 2020-2024"
Reasoning: "Specified metric (CAGR), time period, and industry (EV) for more precise results"

Example 3:
Original Query: "competitive landscape"
Optimized Query: "Tesla BYD Volkswagen electric vehicle market share competition 2024"
Reasoning: "Added specific competitors and year to find relevant competitive analysis"

====================
OUTPUT REQUIREMENTS
====================

Output ONLY a valid JSON array with this exact structure:

[
  {
    "originalQuery": "string",
    "optimizedQuery": "string",
    "reasoning": "string"
  },
  ...
]

**CRITICAL RULES:**
- Output ONLY valid JSON (no markdown, no explanations)
- Each optimized query must be 3-15 words
- All strings must be trimmed (no leading/trailing whitespace)
- Do not include empty fields
- Preserve the order of original queries`;
}

/**
 * Generate structured content from searched results
 */
export function createStructuredContentPrompt(
  taskPlan: MarketingTaskPlan,
  searchSnippets: string[],
  userContext?: Record<string, any>
): string {
  return `You are a Senior Market Research Analyst specializing in data synthesis and structured reporting.

Your task is to analyze search results and produce a comprehensive, structured research output for a specific market research task.

====================
TASK CONTEXT
====================
**Task ID:** ${taskPlan.taskId}
**Research Goal:** ${taskPlan.researchGoal}

**Search Directions:**
${taskPlan.searchDirections.map((d, i) => `${i + 1}. ${d}`).join("\n")}

**Key Elements to Focus On:**
${taskPlan.keyElements.map((e, i) => `${i + 1}. ${e}`).join("\n")}

${taskPlan.specialFocus && taskPlan.specialFocus.length > 0 ? `
**Special Focus Areas:**
${taskPlan.specialFocus.map((f, i) => `${i + 1}. ${f}`).join("\n")}
` : ""}

${taskPlan.timeFrame ? `
**Time Frame:**
- Historical: ${taskPlan.timeFrame.historical || "Not specified"}
- Current: ${taskPlan.timeFrame.current || "Not specified"}
- Forecast: ${taskPlan.timeFrame.forecast || "Not specified"}
` : ""}

${userContext ? `
**User Context:**
${JSON.stringify(userContext, null, 2)}
` : ""}

====================
SEARCH RESULTS (${searchSnippets.length} snippets)
====================
${searchSnippets.length === 0 
  ? "NO SEARCH RESULTS AVAILABLE - Please note the lack of data in your summary"
  : searchSnippets.map((snippet, i) => `
[Snippet ${i + 1}]
${snippet.substring(0, 800)}${snippet.length > 800 ? "..." : ""}
`).join("\n")
}

====================
YOUR RESPONSIBILITIES
====================

Analyze the search snippets above and produce a structured research output with:

1. **SUMMARY** (100-500 words):
   - Synthesize key findings from the search results
   - Address the research goal directly
   - Reference specific data points when available
   - If data is limited or missing, explicitly state this
   - Connect findings to the key elements listed above
   - Use professional, objective language

2. **KEY FINDINGS** (3-10 bullet points):
   - Extract the most important insights from the snippets
   - Format: "<Insight>: <Supporting evidence/data>"
   - Prioritize findings related to key elements
   - Be specific - include numbers, percentages, dates when available
   - If certain key elements lack data, mention this as a finding

3. **DATA POINTS** (structured key-value pairs):
   - Extract quantifiable metrics and structured data
   - Use clear, descriptive keys (camelCase format)
   - Include units in key names (e.g., "marketSize2024Billions")
   - Examples:
     * "marketSize2024USD": 384.7
     * "cagr20202024Percent": 18.5
     * "topCompetitor": "Tesla"
   - Only include data actually found in snippets (no fabrication)

4. **SOURCES** (array of source identifiers):
   - List which snippets were used (e.g., ["snippet-1", "snippet-3", "snippet-5"])
   - Include all snippets that contributed to your findings

====================
CRITICAL RULES
====================

✓ **Use ONLY information from the provided snippets**
   - Do not fabricate data or make unsupported claims
   - If a key element has no data, acknowledge this in your summary

✓ **Be specific and quantitative**
   - Prefer numbers over vague descriptions
   - Include time periods, units, and geographic specificity
   - Example: "Market grew 18.5% CAGR from 2020-2024" vs "Market grew significantly"

✓ **Acknowledge data limitations**
   - If snippets are incomplete, say so
   - If conflicting data exists, note this
   - If certain key elements are not covered, mention it

✓ **Maintain objectivity**
   - Present findings without bias
   - Distinguish facts from projections
   - Cite specific snippets for controversial claims

✗ **DO NOT:**
   - Invent statistics or data points
   - Make predictions beyond what snippets suggest
   - Include information not in the snippets
   - Use vague language when specific data is available

====================
OUTPUT FORMAT
====================

Return ONLY a valid JSON object (no markdown, no code blocks, no explanations):

{
  "summary": "string (100-500 words)",
  "keyFindings": [
    "string (1-2 sentences each)",
    ...
  ],
  "dataPoints": {
    "descriptiveKey": value,
    ...
  },
  "sources": ["snippet-1", "snippet-2", ...]
}

**Validation Requirements:**
- summary: minimum 100 characters, maximum 2000 characters
- keyFindings: 3-10 items, each a complete sentence
- dataPoints: at least 1 key-value pair if data is available
- sources: array of snippet identifiers that were actually used

====================
EXAMPLE OUTPUT
====================

{
  "summary": "The global electric vehicle market reached $384.7 billion in 2024, demonstrating robust growth with an 18.5% CAGR from 2020-2024. China dominates with 40% market share, followed by Europe (30%) and North America (20%). Key growth drivers include government incentives, improving battery technology (average capacity now 75 kWh), and rising environmental awareness. Tesla maintains market leadership but faces increasing competition from BYD and traditional OEMs. Supply chain challenges, particularly lithium availability, present near-term risks. Market is projected to exceed $800 billion by 2030, driven by regulatory mandates and cost parity with ICE vehicles.",
  
  "keyFindings": [
    "Market size: Global EV market valued at $384.7B in 2024, up 25% year-over-year",
    "Growth trajectory: Strong 18.5% CAGR from 2020-2024 indicates sustained momentum in electrification",
    "Regional distribution: China leads with 40% share, Europe 30%, North America 20%, rest of world 10%",
    "Technology advancement: Average battery capacity increased to 75 kWh, up from 60 kWh in 2020",
    "Competition dynamics: Tesla holds 15% global share but declining from 20% in 2020 due to new entrants"
  ],
  
  "dataPoints": {
    "marketSize2024Billions": 384.7,
    "cagr20202024Percent": 18.5,
    "chinaMarketSharePercent": 40,
    "europeMarketSharePercent": 30,
    "northAmericaMarketSharePercent": 20,
    "avgBatteryCapacityKwh": 75,
    "teslaMarketSharePercent": 15,
    "projectedSize2030Billions": 800
  },
  
  "sources": ["snippet-1", "snippet-2", "snippet-4", "snippet-6"]
}

Now, analyze the search snippets provided and generate the structured content.`;
}

/**
 * Generate report metadata
 */
export function createReportMetadataPrompt(
  reportFramework: MarketingReportFramework,
  taskResults: Map<string, TaskExecutionResult>,
  userContext?: Record<string, any>
): string {
  const successfulTasks = Array.from(taskResults.values()).filter(r => r.status === "success");
  const researchHighlights = successfulTasks.map(r => {
    const highlight = r.structuredContent.summary;
    return `${highlight}`;
  }).join("\n");

  return `You are refining the report title and objective based on executed research.

====================
ORIGINAL PLAN
====================
**Title:** ${reportFramework.reportTitle}
**Objective:** ${reportFramework.reportObjective}
${userContext ? `**User Context:** ${JSON.stringify(userContext)}` : "Not provided"}

====================
ACTUAL RESEARCH HIGHLIGHTS
====================
(Use these findings to ensure the title/objective matches reality)
${researchHighlights || "No successful research tasks completed."}

====================
INSTRUCTIONS
====================
Refine the report metadata to accurately reflect the gathered data.

1. **Refine Report Title**:
   - Make it professional, specific, and descriptive.
   - **Crucial:** If the research found specific data (e.g., specific years "2024-2030", specific regions "North America", or specific segments), include them in the title.
   - Avoid generic titles like "Market Research".

2. **Refine Report Objective**:
   - Summarize what this report *actually* delivers based on the highlights above.
   - Mention the specific insights or data types included (e.g., "market sizing," "competitor analysis").
   - Ensure it is a coherent, professional statement (1-3 sentences).`;
}

/**
 * Generate executive summary
 */
export function createExecutiveSummaryPrompt(
  reportFramework: MarketingReportFramework,
  taskResults: Map<string, TaskExecutionResult>
): string {
  const allResults = Array.from(taskResults.values());
  const successfulTasks = allResults.filter(r => r.status === "success");

  const taskSummaries = successfulTasks.map(result => {
    const task = reportFramework.tasks.find(t => t.taskId === result.taskId);
    
    // Safety checks for data points
    const dataPoints = result.structuredContent.dataPoints || {};
    const dataPointsStr = Object.entries(dataPoints)
      .slice(0, 8) // Limit to top 8 data points to save tokens
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");

    // Truncate summary if it's too long to prevent context overflow
    const conciseSummary = result.structuredContent.summary.length > 500 
      ? result.structuredContent.summary.substring(0, 500) + "..." 
      : result.structuredContent.summary;

    // Limit key findings
    const topFindings = (result.structuredContent.keyFindings || [])
      .slice(0, 5)
      .map((f) => `${f}`)
      .join("\n");

    return `### Task: ${task?.taskName || result.taskId} (Priority: ${task?.priority || 'Unknown'})
Summary: ${conciseSummary}
Key Findings:
${topFindings}
Data Points: ${dataPointsStr || "None"}
`;
  }).join("\n" + "-".repeat(30) + "\n");


  return `You are writing the executive summary for a major market research report.

**Report Title:** "${reportFramework.reportTitle}"
**Report Objective:** ${reportFramework.reportObjective}

**Top Task Results:**
${taskSummaries}

**Output Requirements (Strict):**

1. **Overview** (200 - 2000 characters):
   - A narrative synthesis of the market situation.
   - Do NOT just list task results; connect the dots between tasks.
   - Focus on the "So What?" - why does this data matter?

2. **Key Highlights** (2-5 items, max 200 chars each):
   - The most impressive numbers or facts found (e.g., Market Size, CAGR).
   - Must be punchy and data-driven.

3. **Critical Insights** (2-5 items, max 250 chars each):
   - Deep strategic observations (e.g., "Competitor X is losing share due to Y").
   - Focus on implications, not just facts.

4. **Recommendations** (2-5 items, max 200 chars each):
   - Actionable next steps based on the data.
   - Start with a verb (e.g., "Invest in...", "Monitor...", "Pivot to...").

**Tone Guidelines:**
- Professional, objective, and authoritative.
- Prioritize insights from "High Priority" tasks.
- If data conflicts between tasks, acknowledge the range or prioritize the more specific source.`;
}

/**
 * Generate section topics based on complete task results
 */
export function createSectionTopicsPrompt(
  reportFramework: MarketingReportFramework,
  taskResults: Map<string, TaskExecutionResult>
): string {
  const successfulTasks = Array.from(taskResults.values()).filter(r => r.status === "success");
  
  // Build detailed task information
  const taskDetailsArray = successfulTasks.map(result => {
    const taskMeta = reportFramework.tasks.find(t => t.taskId === result.taskId);
    
    // Truncate summary for grouping context (we don't need full details to decide sections)
    const conciseSummary = result.structuredContent.summary.length > 300
      ? result.structuredContent.summary.substring(0, 300) + "..."
      : result.structuredContent.summary;

    // Limit findings to top 3 just to give flavor of the content
    const findings = (result.structuredContent.keyFindings || [])
      .slice(0, 3)
      .map(f => `    - ${f.substring(0, 100)}`) // Also truncate individual findings
      .join('\n');
    
    // Only list data keys to show what kind of data is available (save tokens by omitting values)
    const dataKeys = Object.keys(result.structuredContent.dataPoints || {}).slice(0, 5).join(", ");
    const dataInfo = dataKeys ? `\n  Available Metrics: ${dataKeys}` : '';

    return `Task ID: ${result.taskId}
  Name: ${taskMeta?.taskName || result.taskName}
  Priority: ${taskMeta?.priority || 'medium'}
  Intent: ${taskMeta?.taskDescription || 'N/A'}
  Result Summary: ${conciseSummary}
  Key Insights:
${findings}${dataInfo}`;
  });

  const taskDetails = taskDetailsArray.join('\n\n');

  return `You are a professional marketing research analyst organizing the structure of a comprehensive market research report.

# REPORT CONTEXT

**Report Title:** ${reportFramework.reportTitle}
**Report Objective:** ${reportFramework.reportObjective}

# COMPLETED RESEARCH TASKS
${taskDetails}


# YOUR TASK
Analyze ALL the research tasks above and organize them into a logical report structure with 3-8 thematic sections.

## REQUIREMENTS

1. **Comprehensive Coverage:** Every single task ID listed above MUST be assigned to exactly one section topic. Do not omit any task.

2. **Logical Grouping:** Group tasks that share common themes, research dimensions, or analytical perspectives. Consider these common research dimensions:
   - Market overview and landscape analysis
   - Market sizing and quantitative analysis
   - Competitive dynamics and player analysis
   - Trend identification and drivers
   - Regional/segment-specific insights
   - Future outlook and forecasting
   - Strategic implications

3. **Logical Flow:** Organize topics in a narrative sequence that builds understanding progressively. Typically:
   - Start with foundational/contextual topics (overview, definitions)
   - Progress to analytical topics (sizing, competitive analysis)
   - Move to insights (trends, drivers, opportunities)
   - Conclude with forward-looking topics (forecasts, recommendations)

4. **Naming Conventions:** 
   - Section titles must be professional (e.g., "Global Market Sizing & Growth", "Competitive Landscape").
   - Avoid generic names like "Section 1" or "Task Group A".

5. **Balanced Distribution:** Aim for relatively balanced sections (avoid putting 10 tasks in one section and 1 in another unless there's a strong thematic reason).

6. **Descriptive Context:** Each topic description should:
   - Explain the analytical focus of the section (50-200 words)
   - Indicate what insights readers should expect
   - Connect to the overall report objective`;
}


/**
 * Generate a single section
 */
export function createSingleSectionPrompt(
  reportTitle: string,
  reportObjective: string,
  sectionIndex: number,
  sectionTopic: string,
  relevantTasks: TaskExecutionResult[],
): string {
  const taskDetails = relevantTasks.map((result) => {
    const { structuredContent } = result;
    const summary = structuredContent?.summary || "";
    const truncatedSummary =
      summary.length > 400 ? `${summary.slice(0, 400)}...` : summary;

    const findings = (structuredContent?.keyFindings || [])
      .slice(0, 5)
      .map((f) => `${f.slice(0, 200)}`)
      .join("\n");

    const dataKeys = Object.keys(structuredContent?.dataPoints || {})
      .slice(0, 6)
      .join(", ");
    
    const sources = (structuredContent?.sources || [])
      .slice(0, 10)
      .join(", ");

    return `### Task ID: ${result.taskId}
Task Name: ${result.taskName}
Summary: ${truncatedSummary}
Key Findings: ${findings || "No explicit findings reported."}
Data Keys: ${dataKeys || "None"}
Source: ${sources || "None"}`;
  }).join("\n\n" + "-".repeat(40) + "\n\n");

  return `You are writing section ${sectionIndex + 1} for a strategic report.

====================
REPORT BACKGROUND
====================
Report Title: "${reportTitle}"
Report Objective: "${reportObjective}"

====================
SECTION ASSIGNMENT
====================
Section Topic: "${sectionTopic}"
Section Number: ${sectionIndex + 1}

====================
AVAILABLE RESEARCH INPUT
====================
${taskDetails || "No successful task results were provided."}

====================
GUIDELINES
====================
Use ONLY the information above to draft this section.

Output must be a JSON object with these exact fields:
{
  "sectionTitle": string (3-100 chars),
  "content": string (100-3000 chars),
  "keyFindings": string[] (1-5 items, each ≤300 chars),
  "dataPoints": { ... },
  "relatedTaskIds": string[]
}

Detailed instructions:
1. sectionTitle  
   - Clear, professional title aligned with the topic.  
   - Stay under 100 characters.

2. content (100-3000 characters)  
   - Structure: short intro → synthesized analysis → implications.  
  - Reference key metrics and insights from the tasks.  
   - Keep within the 3000-character schema limit.  
   - Use paragraph formatting; avoid lists unless crucial.  
   - If data is missing or conflicting, state it plainly.

3. keyFindings (1-5 items)  
   - Each finding ≤300 characters.  
   - Highlight the most critical takeaways tied to the section topic.  
   - Include quantitative evidence when available.

4. dataPoints  
   - Aggregate the most relevant metrics from the tasks.  
   - Use camelCase keys (e.g., marketSize2024Usd).  
   - Only include values explicitly present in the input.  
   - For conflicting values, expose both with task suffixes (e.g., marketSize2024_task3).  
   - Leave the object empty if no trustworthy numbers are present.

5. relatedTaskIds  
   - List every task ID included in the input block (no extra items).  
   - Preserve the original format ("task-1", etc.).
`;
}

/**
 * Generate consolidated data
 */
export function createConsolidatedDataPrompt(
  reportFramework: MarketingReportFramework,
  taskResults: Map<string, TaskExecutionResult>
): string {
  const successfulTasks = Array.from(taskResults.values()).filter(r => r.status === "success");
  
  const taskDetailsArray = successfulTasks.map(result => {
    const taskMeta = reportFramework.tasks.find(t => t.taskId === result.taskId);
    
    // Safety check for dataPoints
    const dataPoints = result.structuredContent.dataPoints || {};
    const dataEntries = Object.entries(dataPoints)
      .slice(0, 15) 
      .map(([key, value]) => `    - ${key}: ${JSON.stringify(value)}`)
      .join("\n");
    const sources = (result.structuredContent.sources || []).join(", ");

    return `### Task: ${taskMeta?.taskName || result.taskName} (ID: ${result.taskId})
Priority: ${taskMeta?.priority || "medium"}
Data Points:
${dataEntries || "    - No structured data found"}
Sources: ${sources || "None"}
`;
  }).join("\n\n");

  return `You are a Data Analyst consolidating research findings into a master dataset.

====================
REPORT CONTEXT
====================
**Report Title:** "${reportFramework.reportTitle}"
**Report Objective:** "${reportFramework.reportObjective}"

====================
RAW DATA FROM TASKS
====================
${taskDetailsArray || "No successful task data available."}

====================
CONSOLIDATION INSTRUCTIONS
====================
Analyze the raw data above and produce a consolidated JSON object.

1. **allDataPoints** (Comprehensive Record):
   - Merge ALL data points from the tasks above.
   - Use camelCase keys (e.g., \`marketSize2024Usd\`).
   - **Conflict Resolution**: If multiple tasks report the same metric with different values, preserve BOTH by appending the task ID.
     - Example: \`marketSize_task1: 100, marketSize_task2: 105\`
   - **Normalization**: Ensure units are clear in the keys (e.g., use \`revenueUsdBillions\` instead of just \`revenue\`).

2. **keyMetrics** (Strategic Selection):
   - Select the top 5-15 metrics that are MOST critical to the **Report Objective**.
   - Prioritize data from "High Priority" tasks.
   - These should be the "headline numbers" for the report.

3. **dataSources** (Deduplication):
   - Extract all source IDs (e.g., "snippet-1") listed in the "Sources" fields above.
   - Return a single, deduplicated array of strings.
   - Filter out "None" or empty strings.`;
}

/**
 * Generate conclusion
 */
export function createConclusionPrompt(
  reportObjective: string,
  sections: Array<{ sectionTitle: string; keyFindings: string[] }>,
  taskResults: Map<string, TaskExecutionResult>
): string {
  const successfulTasks = Array.from(taskResults.values()).filter(r => r.status === "success");
  const failedTasks = Array.from(taskResults.values()).filter(r => r.status === "failed");
  
  const sectionSummaries = sections.map((s, i) => {
    return `${i + 1}. ${s.sectionTitle}: ${s.keyFindings.slice(0, 2).join("; ")}`;
  }).join("\n");

  return `You are writing the conclusion for a marketing research report.

**Report Objective:** ${reportObjective}

**Section Summaries:**
${sectionSummaries}

**Execution Summary:**
- Successful tasks: ${successfulTasks.length}
- Failed tasks: ${failedTasks.length}

**Requirements:**
- **summary** (100-800 words):
  * Recap key findings and their implications
  * Answer the original research objective
  * Synthesize cross-task insights
  
- **strategicRecommendations** (2-5 items):
  * Specific, actionable recommendations for stakeholders
  * Based on evidence from the research
  * Prioritized by importance
  
- **futureOutlook** (50-500 words):
  * Trends to watch
  * Potential opportunities or challenges ahead
  * Market evolution expectations
  
- **limitations** (0-5 items):
  * Acknowledge data gaps from failed tasks
  * Note areas requiring further research
  * Specify any assumptions made
  * Mention data conflicts if unresolved`;
}

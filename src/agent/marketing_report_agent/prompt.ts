import { ChatPromptTemplate } from "@langchain/core/prompts";
import { 
  MarketingTaskPlan, 
  MarketingTaskMetadata, 
  MarketingReportFramework 
} from "../../types/agent/agent.types"

/**
 * Create prompt for dynamic report planning
 */
export function createReportPlanningPrompt(
  userInput: string,
  userContext: Record<string, any>
): ChatPromptTemplate {
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

  return ChatPromptTemplate.fromMessages([
      ["system", systemMessage],
      ["human", userMessage],
    ]);
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
  const currentYear = new Date('2025-11-03T14:17:15Z').getUTCFullYear();

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



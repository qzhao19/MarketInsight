import { END, START, StateGraph } from "@langchain/langgraph";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Logger } from "@nestjs/common"; 
import { MarketingResearchState } from "./state";
import { 
  createReportPlanningPrompt, 
  createTaskPlanPrompt,
  createQueryOptimizationPrompt,
  createStructuredContentPrompt,
  createReportSynthesisPrompt,
} from "./prompt"
import { 
  ReportFrameworkSchema, 
  TaskPlanSchema, 
  OptimizedQueriesSchema,
  StructuredContentSchema,
  FinalMarketingReportSchema,
} from "./schema";
import { 
  validateTaskDependencies, 
  topologicalSort,
  groupIntoBatches, 
  sortByPriority,
} from "../../utils/agent.utils"
import { 
  FinalMarketingReport,
  MarketingTaskPlan,
  MarketingTaskMetadata, 
  MarketingReportFramework, 
  OptimizedQuery,
  TaskExecutionBatch,
  TaskExecutionConfig,
  TaskExecutionResult,
  TaskExecutionSchedule,
  SearchResultItem,
} from "../../types/agent/agent.types"

// Instantiate logger at the top of the file.
const logger = new Logger('MarketResearchNodes');

async function reportPlanningNode(
  state: typeof MarketingResearchState.State,
  config: any
): Promise<Partial<typeof MarketingResearchState.State>> {
  const model = config.configurable.model;
  const { userInput, userContext } = state;

  logger.log("Starting marketing report planning...");

  try {
    // Generate planning prompt
    const prompt = createReportPlanningPrompt(userInput, userContext);

    // Call LLM using schema for structured output
    const structuredPlanModel = model.withStructuredOutput(ReportFrameworkSchema, { 
      name: "ReportFrameworkGeneration"
    });

    const rawReportFramework = await structuredPlanModel.invoke(prompt);
    if (!rawReportFramework || !rawReportFramework.tasks || rawReportFramework.tasks.length === 0) {
      const errorMsg = "LLM returned invalid report framework (missing tasks array).";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate task dependencies
    const dependencyValidation = validateTaskDependencies(rawReportFramework.tasks);
    if (!dependencyValidation.valid) {
      const errorMsg = `Invalid task dependencies:\n${dependencyValidation.errors.join("\n")}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Add taskId to each task
    const taskWithIdList: MarketingTaskMetadata[] = rawReportFramework.tasks.map(
      (task: MarketingTaskMetadata, index: number) => ({
        taskId: `task-${index + 1}`,
        taskName: task.taskName,
        taskDescription: task.taskDescription,
        priority: task.priority,
        dependencies: task.dependencies,
      })
    );
    
    // Build final report framework
    const reportFrameworkWithTaskId: MarketingReportFramework = {
      reportTitle: rawReportFramework.reportTitle,
      reportObjective: rawReportFramework.reportObjective,
      tasks: taskWithIdList,
    };

    logger.log(`Report planning completed successfully`);
    return { 
      reportFramework: reportFrameworkWithTaskId 
    };

  } catch (error) {
    const errorMsg = `Report planning failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
};

async function generateSingleTaskPlan(
  task: MarketingTaskMetadata,
  reportFramework: MarketingReportFramework,
  userContext: Record<string, any> | undefined,
  model: any
): Promise<MarketingTaskPlan> {

  // Generate prompt
  const prompt = createTaskPlanPrompt(task, reportFramework, userContext);
  
  // Invoke the LLM with structured output based on the Zod schema
  const structuredPlanModel = model.withStructuredOutput(TaskPlanSchema, { 
    name: `TaskPlan_${task.taskId}`
  }); 
  const taskPlanOutput = await structuredPlanModel.invoke(prompt)

  // Combine the LLM output with the original taskId
  const completeTaskPlan: MarketingTaskPlan = {
    taskId: task.taskId,
    ...taskPlanOutput,
  };

  return completeTaskPlan;
}

async function taskPlanGenerationNode(
  state: typeof MarketingResearchState.State,
  config: any
): Promise<Partial<typeof MarketingResearchState.State>> {

  const model = config.configurable.model;
  const { reportFramework, userContext } = state;

  if (!reportFramework) {
    const errorMsg = "Report framework is missing. Cannot generate task plans.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.log("Starting task plan generation...");

  const tasks = reportFramework!.tasks;
  const taskPlans = new Map<string, MarketingTaskPlan>();

  for (const task of tasks) {
    try {
      const completePlan = await generateSingleTaskPlan(
        task, reportFramework, userContext, model
      );
      taskPlans.set(task.taskId, completePlan);
    } catch (error) {
      const errorMsg = `Failed to generate plan for task: ${
        error instanceof Error ? error.message : String(error)
      }`;
      logger.error(errorMsg);
      throw new Error(errorMsg)
    }
  }

  logger.log(`Task plan generation finished.`);
  return { taskPlans }
}

async function taskSchedulingNode(
  state: typeof MarketingResearchState.State,
  config: any
): Promise<Partial<typeof MarketingResearchState.State>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const model = config.configurable.model;
  const { reportFramework } = state;
  
  logger.log("Starting task scheduling...");

  if (!reportFramework) {
    const errorMsg = "Report framework is missing. Cannot generate task plans.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const tasks = reportFramework.tasks;

  try {
    // Perform topological sort
    const sortedTaskIds = topologicalSort(tasks);

    // Group tasks into execution batches
    const batchGroups = groupIntoBatches(tasks, sortedTaskIds);

    // Sort tasks within each batch by priority
    const taskMap = new Map<string, MarketingTaskMetadata>();
    tasks.forEach((task) => taskMap.set(task.taskId, task));

    const executionBatches: TaskExecutionBatch[] = batchGroups.map((batchTaskIds, index) => {
      // Sort by priority within batch
      const sortedBatchIds = sortByPriority(batchTaskIds, taskMap);
      // Get task names for description
      const taskNames = sortedBatchIds
        .map(id => taskMap.get(id)?.taskName)
        .filter((name): name is string => name !== undefined);

      // Count priorities
      const priorities = sortedBatchIds.map(id => taskMap.get(id)?.priority);
      const highCount = priorities.filter(p => p === "high").length;
      const mediumCount = priorities.filter(p => p === "medium").length;
      const lowCount = priorities.filter(p => p === "low").length;

      const batch: TaskExecutionBatch = {
        batchNumber: index + 1,
        taskIds: sortedBatchIds,
        description: `Batch ${index + 1}: ${taskNames.join(", ")} (${highCount}H/${mediumCount}M/${lowCount}L)`,
      };
      return batch;
    });
    
    // Build final schedule
    const taskSchedule: TaskExecutionSchedule = {
      executionBatches,
      taskOrder: sortedTaskIds,
      totalBatches: executionBatches.length,
    };
    
    logger.log(`Task scheduling completed successfully`);
    return { taskSchedule };
  } catch (error) {
    const errorMsg = `Task scheduling failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}

async function executeSearchWithRetry(
  query: string,
  serpApi: SerpAPI,
  config: TaskExecutionConfig
): Promise<SearchResultItem[]> {

  let errorMsg: Error | null = null;
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      // Create timeout promise
      const searchPromise = serpApi.invoke(query);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timeout")), config.searchTimeout)
      );
      const rawResult = await Promise.race([searchPromise, timeoutPromise]);

      if (rawResult && typeof rawResult === "string") {
        return [{ query, result: rawResult }];
      }
      
      return [];
    } catch (error) {
      errorMsg = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Attempt ${attempt} failed: ${errorMsg.message}`);

      if (attempt < config.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw errorMsg || new Error("Search failed after all retries");
}


async function executeSingleTask(
  taskPlan: MarketingTaskPlan,
  userContext: Record<string, any> | undefined,
  model: any,
  serpApi: SerpAPI,
  config: TaskExecutionConfig
): Promise<TaskExecutionResult> {

  try {
    // Optimize queries
    const optimizedQueriesPrompt = createQueryOptimizationPrompt(taskPlan);
    const structuredModel = model.withStructuredOutput(OptimizedQueriesSchema, {
        name: `QueryOptimization_${taskPlan.taskId}`,
      });
    const optimizedQueriesResult = await structuredModel.invoke(optimizedQueriesPrompt);
    
    let optimizedQueries: OptimizedQuery[] = []
    if (optimizedQueriesResult && Array.isArray(optimizedQueriesResult.optimizedQueries)) {
      optimizedQueries = optimizedQueriesResult.optimizedQueries;
    } else {
      logger.warn(`Query optimization failed for ${taskPlan.taskId}, using original queries`);
      optimizedQueries = taskPlan.searchQueries.map(q => ({
        originalQuery: q,
        optimizedQuery: q,
        reasoning: "Using original query (optimization failed)",
      }));
    }

    // Limit queries and execute searches: parallel or sequential
    const queriesToExecute = optimizedQueries.slice(0, config.maxQueriesPerTask);
    const searchPromises = queriesToExecute.map((oq: OptimizedQuery) =>
      executeSearchWithRetry(oq.optimizedQuery, serpApi, config).catch((error) => {
        logger.error(`Search failed for "${oq.optimizedQuery}": ${error}`);
        return [] as SearchResultItem[];
      })
    );

    const searchResultsArray = config.parallelSearches
      ? await Promise.all(searchPromises)
      : await searchPromises.reduce(
          async (accPromise: Promise<SearchResultItem[][]>, nextPromise: Promise<SearchResultItem[]>) => {
            const acc = await accPromise;
            const next = await nextPromise;
            return [...acc, next];
          },
          Promise.resolve([] as SearchResultItem[][])
        );
    
    // Flatten and deduplicate results, and extract the text snippets for the prompt
    const allResults: SearchResultItem[] = searchResultsArray.flat();
    const searchSnippets: string[] = allResults.map(item => item.result);
    
    // Generate structured content
    const contentPrompt = createStructuredContentPrompt(taskPlan, searchSnippets, userContext);
    const contentGenerationModel = model.withStructuredOutput(StructuredContentSchema, {
      name: `StructuredContent_${taskPlan.taskId}`,
    });

    const structuredContent = await contentGenerationModel.invoke(contentPrompt);

    return {
      taskId: taskPlan.taskId,
      taskName: taskPlan.researchGoal.slice(0, 100) || taskPlan.taskId,
      status: "success",
      optimizedQueries,
      totalSearchResults: allResults.length,
      structuredContent,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      taskId: taskPlan.taskId,
      taskName: taskPlan.researchGoal.slice(0, 100) || taskPlan.taskId,
      status: "failed",
      optimizedQueries: [],
      totalSearchResults: 0,
      structuredContent: {
        summary: "",
        keyFindings: [],
        dataPoints: {},
        sources: [],
      },
      error: errorMsg,
    };
  }
}

async function taskExecutionNode(
  state: typeof MarketingResearchState.State,
  config: any
): Promise<Partial<typeof MarketingResearchState.State>> {

  logger.log("Starting task execution...");

  const { model, serpApiKey, executionConfig } = config.configurable;
  const { taskSchedule, taskPlans, userContext } = state;
  
  if (!taskSchedule) {
    const errorMsg = "Task schedule is missing. Cannot execute task.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (!taskPlans || taskPlans.size === 0) {
    const errorMsg = "Task plans is missing. Cannot execute task.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Initialize SerpAPI
  const serpApi = new SerpAPI(serpApiKey);
  const taskExecutionResults = new Map<string, TaskExecutionResult>();

  for (const batch of taskSchedule!.executionBatches) {
    const batchPromises = batch.taskIds.map(async (taskId) => {
      const taskPlan = taskPlans.get(taskId);
      if (!taskPlan) {
        logger.error(`Task plan not found for taskId: ${taskId}`);
        return;
      }

      const result = await executeSingleTask(taskPlan, userContext, model, serpApi, executionConfig);
      taskExecutionResults.set(taskId, result);
    });

    await Promise.all(batchPromises);
    logger.log(`Batch ${batch.batchNumber} completed\n`);
  }

  logger.log(`Task execution completed successfully`);
  return { taskExecutionResults };
}

async function reportSynthesisNode(
  state: typeof MarketingResearchState.State,
  config: any
): Promise<Partial<typeof MarketingResearchState.State>> {
  logger.log("Starting Final Report Synthesis...");

  const model = config.configurable.model;
  const { reportFramework, taskExecutionResults, userContext } = state;

  if (!reportFramework) {
    const errorMsg = "Report framework is missing. Cannot execute tasks.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (!taskExecutionResults || taskExecutionResults.size === 0) {
    const errorMsg = "Task execution results are missing. Cannot execute tasks.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const successfulTasks = Array.from(taskExecutionResults.values())
      .filter(r => r.status === "success").length;

    // Generate synthesis prompt
    const prompt = createReportSynthesisPrompt(
      reportFramework, taskExecutionResults, userContext
    );

    // Single LLM call to generate complete report
    const structuredModel = model.withStructuredOutput(FinalMarketingReportSchema, { 
      name: "FinalReportSynthesis" 
    });

    const synthesizedReport = await structuredModel.invoke(prompt);

    if (!synthesizedReport) {
      throw new Error("Failed to generate report");
    }

    // Add metadata
    const finalReport: FinalMarketingReport = {
      ...synthesizedReport,
      totalTasks: taskExecutionResults.size,
      successfulTasks,
    };

    logger.log(`Report synthesis completed successfully`);
    return { finalReport };

  } catch (error) {
    const errorMsg = `Report synthesis failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}

// Build graph
const MarketingResearchGraph = new StateGraph(MarketingResearchState)
  .addNode("reportPlanning", reportPlanningNode)
  .addNode("taskPlanGeneration", taskPlanGenerationNode)
  .addNode("taskScheduling", taskSchedulingNode)
  .addNode("taskExecution", taskExecutionNode)
  .addNode("reportSynthesis", reportSynthesisNode)

MarketingResearchGraph.addEdge(START, "reportPlanning")
MarketingResearchGraph.addEdge("reportPlanning", "taskPlanGeneration")
MarketingResearchGraph.addEdge("taskPlanGeneration", "taskScheduling")
MarketingResearchGraph.addEdge("taskScheduling", "taskExecution")
MarketingResearchGraph.addEdge("taskExecution", "reportSynthesis")
MarketingResearchGraph.addEdge("reportSynthesis", END)

export { MarketingResearchGraph };

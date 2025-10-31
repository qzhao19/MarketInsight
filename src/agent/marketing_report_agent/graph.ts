import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Logger } from "@nestjs/common"; 
import { MarketingResearchState } from "./state";
import { createReportPlanningPrompt, createTaskPlanPrompt } from "./prompt"
import { ReportFrameworkSchema, TaskPlanSchema } from "./schema";
import { 
  validateTaskDependencies, 
  topologicalSort,
  groupIntoBatches, 
  sortByPriority,
} from "../../utils/agent.utils"
import { 
  MarketingTaskPlan,
  MarketingTaskMetadata, 
  MarketingReportFramework, 
  TaskExecutionBatch,
  TaskExecutionSchedule,
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
    const structuredPlanModel = model.withStructuredOutput(
      ReportFrameworkSchema, 
      { name: "ReportFrameworkGeneration"}
    );

    const rawReportFramework = await structuredPlanModel.invoke(prompt);
    if (!rawReportFramework || !rawReportFramework.tasks || rawReportFramework.tasks.length === 0) {
      const errorMsg = "LLM returned invalid report framework (missing tasks array).";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    logger.log(`LLM generated ${rawReportFramework.tasks.length} tasks.`);

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
  const structuredPlanModel = model.withStructuredOutput(
    TaskPlanSchema, 
    { name: `TaskPlan_${task.taskId}`}
  ); 
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

  logger.log("Starting task plan generation...");

  const tasks = reportFramework!.tasks;
  const taskPlans = new Map<string, MarketingTaskPlan>();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    try {
      const completePlan = await generateSingleTaskPlan(
        task,
        reportFramework!,
        userContext,
        model
      );
      taskPlans.set(task.taskId, completePlan);
    } catch (error) {
      const errorMsg = `Failed to generate plan for task: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      throw new Error(errorMsg)
    }
  }
  logger.log(`Stage 2 completed: Task plan generation finished.`);

  return { taskPlans }
}

async function taskSchedulingNode(
  state: typeof MarketingResearchState.State,
  config: any
): Promise<Partial<typeof MarketingResearchState.State>> {
  logger.log("Starting task scheduling...");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const model = config.configurable.model;
  const { reportFramework } = state;
  const tasks = reportFramework!.tasks;

  try {
    // Perform topological sort
    const sortedTaskIds = topologicalSort(tasks);

    // Group tasks into execution batches
    const batchGroups = groupIntoBatches(tasks, sortedTaskIds);

    // Sort tasks within each batch by priority
    const taskMap = new Map<string, MarketingTaskMetadata>();
    tasks.forEach(task => taskMap.set(task.taskId, task));

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
    
    return {
      taskSchedule,
    };
  } catch (error) {
    const errorMsg = `Task scheduling failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Logger } from "@nestjs/common"; 
import { MarketingResearchState } from "./state";
import { createReportPlanningPrompt, createTaskPlanPrompt } from "./prompt"
import { ReportFrameworkSchema, TaskPlanSchema } from "./schema";
import { validateTaskDependencies } from "../../utils/agent.utils"
import { 
  MarketingTaskPlan,
  MarketingTaskMetadata, 
  MarketingReportFramework 
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
    if (!rawReportFramework || !Array.isArray(rawReportFramework.tasks)) {
      throw new Error("LLM returned invalid report framework (missing tasks array)");
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
    const enrichedReportFramework: MarketingReportFramework = {
      reportTitle: rawReportFramework.reportTitle,
      reportObjective: rawReportFramework.reportObjective,
      tasks: taskWithIdList,
    };

    logger.log(`Stage1: Report planning completed successfully`);

    return { 
      reportFramework: enrichedReportFramework 
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

  if (!reportFramework) {
    const errorMsg = "No tasks available in reportFramework. Cannot generate task plans.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const tasks = reportFramework.tasks;
  const taskPlans = new Map<string, MarketingTaskPlan>();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    try {
      const completePlan = await generateSingleTaskPlan(
        task,
        reportFramework,
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


import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { RunnableConfig } from "@langchain/core/runnables";
import { MarketingResearchGraph } from "./marketing-report-agent/graph"
import { AppConfigService } from "../config/config.service";
import { LLModelService } from "../llm/model.service";
import { 
  AgentInvokeOptions, 
  FinalMarketingReport,
  TaskExecutionConfig
} from "../types/agent/agent.types";

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private workflow: ReturnType<typeof MarketingResearchGraph.compile>;
  private serpApiKey: string;

  constructor(
    private readonly modelService: LLModelService, 
    private readonly configService: AppConfigService
  ) {

    // Read from AppConfigService
    this.serpApiKey = this.configService.serpApiKey;
    if (!this.serpApiKey) {
      throw new Error("Serp API key is missing from workflow configuration.");
    }

    try {
      this.workflow = MarketingResearchGraph.compile();
      this.logger.log('Marketing research workflow compiled successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to compile workflow: ${errorMsg}`);
      throw new Error(`Failed to compile workflow: ${errorMsg}`);
    }

  }

  onModuleInit() {
    this.logger.log('AgentService initialized');
  }

  private buildWorkflowConfig(
    model: any,
    executionConfig: TaskExecutionConfig,
  ): RunnableConfig {
    return {
      configurable: {
        model,
        serpApiKey: this.serpApiKey,
        executionConfig,
      },
      tags: ["marketing-research-agent"],
    };
  }

  public async invoke(
    userInput: string, 
    agentInvokeOptions: AgentInvokeOptions,
  ): Promise<FinalMarketingReport> {

    this.logger.log(`Starting marketing research...`);

    // Extract options with defaults
    const {
      userContext, modelConfig, taskExecutionConfig,
    } = agentInvokeOptions;

    try {
      // Get LLM configs
      const model = await this.modelService.getDeepSeekGuardModel(modelConfig || {});
      if (!model) {
        throw new Error("Failed to initialize LLM model");
      }

      // Use default configs for task execution
      const defaultExecutionConfig = this.configService.AgentConfig.defaultExecutionConfig;

      const finalExecutionConfig: TaskExecutionConfig = {
        ...defaultExecutionConfig,
        ...taskExecutionConfig,
      };

      // Prepare initial state for workflow
      const initialState = {
        userInput,
        userContext: userContext || {},
      };

      const workflowConfig = this.buildWorkflowConfig(
        model, 
        finalExecutionConfig, 
      );

      // Execute the workflow
      const result = await this.workflow.invoke(initialState, workflowConfig);
      if (!result.finalReport) {
        throw new Error("Workflow completed but no final report was generated");
      }

      return result.finalReport;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Marketing research workflow failed: ${errorMsg}`);
      throw new Error(`Marketing research workflow failed: ${errorMsg}`);
    }
  }


}

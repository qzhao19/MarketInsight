import { Injectable, Logger } from '@nestjs/common';

import { ModelService } from "../../model/model.service";
import { MarketOverviewGraph } from "./graph/graph";
import { AgentConfigService } from "../../../config/agent.config";
import { 
  MarketResearchInvokeOptions, 
  MarketResearchResult 
} from "../../../types/llm.types";

@Injectable()
export class MarketResearchService {
  private readonly logger = new Logger(MarketResearchService.name);
  private workflow: ReturnType<typeof MarketOverviewGraph.compile>;

  constructor(
    private readonly modelService: ModelService, 
    private readonly agentConfig: AgentConfigService
  ) {
    try {
      this.workflow = MarketOverviewGraph.compile();
      this.logger.log('Market research workflow compiled successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to compile workflow: ${errorMsg}`);
      throw new Error(`Workflow compilation failed: ${errorMsg}`);
    }
  }

  public async invoke(
    userInput: string, 
    options: MarketResearchInvokeOptions = {}
  ): Promise<MarketResearchResult> {

    // Extract options
    const { 
      userContext, modelConfig, modelClientOptions,
    } = options;

    // Set default model configuration
    const finalModelConfig = {
      model: this.agentConfig.defaultModelName,
      temperature: this.agentConfig.defaultModelTemperature,
      ...modelConfig, // User overrides
    };

    // Merge client configuration with defaults
    const finalModelClientOptions = {
      circuitBreakerConfig: {
        ...this.agentConfig.defaultCircuitBreakerConfig,
        ...modelClientOptions?.circuitBreakerConfig,
      },
      rateLimiterConfig: {
        ...this.agentConfig.defaultRateLimiterConfig,
        ...modelClientOptions?.rateLimiterConfig,
      },
      retryConfig: {
        ...this.agentConfig.defaultRetryConfig,
        ...modelClientOptions?.retryConfig,
      },
    };

    try {
      const model = await this.modelService.getDeepSeekGuardModel(
        finalModelConfig,    // Model-level config (ChatOpenAIFields)
        finalModelClientOptions    // Model-client-level config (protection mechanisms)
      );

      if (!model) {
        throw new Error("Failed to initialize model");
      }

      const initialState = {
        userInput,
        userContext
      };

      const workflowConfig = { configurable: { model } };
      const result = await this.workflow.invoke(initialState, workflowConfig);
      return { success: true, result };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Market research workflow error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

}


import { Injectable, Logger } from '@nestjs/common';
import { LLModelService } from "../../llm/model.service";
import { MarketOverviewGraph } from "./graph/graph";
import { AppConfigService } from "../../config/config.service";
import { 
  MarketResearchInvokeOptions, 
  MarketResearchResult 
} from "../../types/llm/agent.types";

@Injectable()
export class MarketResearchService {
  private readonly logger = new Logger(MarketResearchService.name);
  private workflow: ReturnType<typeof MarketOverviewGraph.compile>;
  private serperApiKey: string;

  constructor(
    private readonly modelService: LLModelService, 
    private readonly configService: AppConfigService
  ) {
    
    // Read from AppConfigService
    this.serperApiKey = this.configService.serperApiKey;
    if (!this.serperApiKey) {
      throw new Error("Serper API key is missing from workflow configuration.");
    }

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
      userContext, modelConfig
    } = options;

    try {
      const model = await this.modelService.getDeepSeekGuardModel(modelConfig || {});
      if (!model) {
        throw new Error("Failed to initialize model");
      }

      const initialState = {
        userInput,
        userContext
      };

      const workflowConfig = { 
        configurable: { 
          model,
          serperApiKey: this.serperApiKey
        } 
      };
      const result = await this.workflow.invoke(initialState, workflowConfig);
      return { success: true, result };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Market research workflow error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

}


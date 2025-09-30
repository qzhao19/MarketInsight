import { Injectable, Logger } from '@nestjs/common';

import { ModelService } from "../../model/model.service";
import { MarketOverviewGraph } from "./graph/graph"
import { AnyRecord } from "./graph/state"

@Injectable()
export class MarketResearchService {
  private readonly logger = new Logger(MarketResearchService.name);
  private workflow: ReturnType<typeof MarketOverviewGraph.compile>;

  constructor(private readonly modelService: ModelService) {
    this.workflow = MarketOverviewGraph.compile();
    this.logger.log('Market research workflow compiled successfully');
  }

  public async invoke(
    userInput: string, 
    options: {
      userContext?: AnyRecord;
      modelName?: string;
      temperature?: number;
    } = {}
  ) {

    const { userContext = {}, modelName = "deepseek-chat", temperature = 0 } = options;
    try {
      const model = await this.modelService.getDeepSeekGuardModel({
        model: modelName,
        temperature,
      });

      if (!model) {
        throw new Error("Failed to initialize model");
      }

      const initialState = {
        userInput,
        userContext
      };

      const config = { configurable: { model } };
      const result = await this.workflow.invoke(initialState, config);
      return { success: true, result };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Market research workflow error: ${errorMsg}`);
      return { success: false, error: errorMsg, };
    }
  }

}


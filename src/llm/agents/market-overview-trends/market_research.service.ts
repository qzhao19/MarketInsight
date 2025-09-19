import { Injectable, Logger } from '@nestjs/common';

import { ModelService } from "../../model/model.service";
import { MarketTrendsGraph } from "./graph"
import { AnyRecord } from "./state"

@Injectable()
export class MarketResearchService {
  private readonly logger = new Logger(MarketResearchService.name);
  private workflow: ReturnType<typeof MarketTrendsGraph.compile>;

  constructor(private readonly modelService: ModelService) {
    this.workflow = MarketTrendsGraph.compile();
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
      const model = this.modelService.getDeepSeekGuardModel({
        model: modelName,
        temperature,
      });

      const initialState = {
        userInput,
        userContext
      };

      const config = { configurable: { model } };
      const result = this.workflow.invoke(initialState, config);
      return { success: true, result };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Market research workflow error: ${errorMessage}`);
      return { success: false, error: errorMessage, };
    }
  }

}


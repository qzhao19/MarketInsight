import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

import { MarketResearchService } from "./market-overview-trends/market_research.service"
import { ModelService } from "../model/model.service";
import { AnyRecord } from "./market-overview-trends/graph/state"

export interface AgentOptions {
  userContext?: AnyRecord;
  modelName?: string;
  temperature?: number;
}

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly marketResearchService: MarketResearchService,
    private readonly modelService: ModelService 
  ) {}

  onModuleInit() {
    this.logger.log('AgentService initialized');
  }

   async analyze(userInput: string, options: AgentOptions = {}): Promise<any> {
    try {
      const result = await this.marketResearchService.invoke(userInput, options);
          
      return {
        ...result,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Analysis failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

}

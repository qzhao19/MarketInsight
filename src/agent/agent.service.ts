import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { MarketResearchService } from "./market-overview-trends/market_research.service"
import { 
  MarketResearchInvokeOptions, 
  MarketResearchResult 
} from '../types/llm/agent.types';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly marketResearchService: MarketResearchService,
  ) {}

  onModuleInit() {
    this.logger.log('AgentService initialized');
  }

  public async executeMarketResearch(
    userInput: string, 
    options?: MarketResearchInvokeOptions
  ): Promise<MarketResearchResult> {
    this.logger.log(`Executing market research for: ${userInput}`);

    try {
      const result = await this.marketResearchService.invoke(userInput, options);
          
      if (result.success) {
        this.logger.log('Market research completed successfully');
      } else {
        this.logger.error(`Market research failed: ${result.error}`);
      }

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in market research execution: ${errorMsg}`);
      throw error;
    }
  }

}

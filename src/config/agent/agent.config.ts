import { Injectable } from '@nestjs/common';
import { TaskExecutionConfig } from '../../types/agent/agent.types';

@Injectable()
export class AgentConfigService {
  
  /**
   * Default configuration for task execution
   */
  get defaultExecutionConfig(): TaskExecutionConfig {
    return {
      maxQueriesPerTask: 8,
      searchTimeout: 15000,
      maxRetries: 3,
      parallelSearches: true,
    };
  }
}
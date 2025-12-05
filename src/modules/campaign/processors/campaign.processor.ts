import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { CampaignRepository } from "../repositories/campaign.repository";
import { AgentService } from "../../../core/agent/agent.service";
import { CampaignJobData } from "../../../common/types/job/queue.types";
import { AggregateCampaignResultData } from "../types/campaign.repo-types";
import { 
  AgentInvokeOptions,
  AgentRunResult,
  TaskExecutionResult,
} from "../../../common/types/agent/agent.types";
import { CampaignStatus } from "../../../common/types/database/entity.types";

@Processor("campaign-processing")
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly agentService: AgentService,
  ) {
    super();
  }

  /**
   * Transform Agent's TaskExecutionResult[] to repository format
   */
  private transformTaskResults(
    taskExecutionResults: TaskExecutionResult[]
  ): AggregateCampaignResultData['tasks'] {
    return taskExecutionResults.map((result, index) => ({
      priority: index + 1,
      result: result, // TaskExecutionResult is compatible with TaskResult
    }));
  }

  /**
   * Handle Campaign failure - mark as ARCHIVED but keep result as null
   */
  private async handleCampaignFailure(
    campaignId: string,
    error: string
  ): Promise<void> {
    try {
      await this.campaignRepository.updateCampaign(campaignId, {
        status: CampaignStatus.ARCHIVED,
        // result remains null, indicating failure
      });
      this.logger.log(`Campaign ${campaignId} marked as failed (archived)`);
    } catch (updateError) {
      this.logger.error(
        `Failed to update campaign status: ${
          updateError instanceof Error ? updateError.message : String(updateError)
        }`
      );
    }
  }


  public async process(job: Job<CampaignJobData>): Promise<any> {
    const { campaignId, userId, metadata } = job.data;

    this.logger.log(`Processing campaign: ${campaignId} for user: ${userId}`);

    try {
      // Get Campaign data from database 
      await job.updateProgress(5);

      const campaign = await this.campaignRepository.findCampaignById(campaignId);

      // Extract user input from Campaign.input (stored in DB)
      const userPrompt = campaign.input.userPrompt;
      const userContext = campaign.input.userContext;

      // Extract agent options from job metadata (optional runtime config)
      const agentInvokeOptions: AgentInvokeOptions = {
        userContext,
        ...(metadata?.agentInvokeOptions || {}),
      };
      
      await job.updateProgress(10);

      // Agent will generate automatically multiply Tasks and excute
      // During execution, Tasks exist only in Agent memory, not in the database
      this.logger.log(`Invoking agent for campaign: ${campaignId}`);
      const agentResult: AgentRunResult = await this.agentService.invoke(
        userPrompt,
        agentInvokeOptions
      );

      await job.updateProgress(80);

      this.logger.log(`Saving results for campaign: ${campaignId}`);
      
      // Transform TaskExecutionResult[] to the format expected by repository
      const tasksData = this.transformTaskResults(agentResult.taskExecutionResults);

      // Build aggregate data
      const aggregateData: AggregateCampaignResultData = {
        campaignId,
        result: agentResult.finalReport,
        tasks: tasksData,
      };

      // Atomic save: Update Campaign.result + Batch create Tasks
      await this.campaignRepository.aggregateCampaignResult(aggregateData);

      await job.updateProgress(100);

      this.logger.log(
        `Campaign ${campaignId} completed successfully with ${tasksData.length} tasks`
      );

      return agentResult;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Campaign ${campaignId} failed: ${errorMsg}`);

      // Mark Campaign as failed (ARCHIVED without result)
      await this.handleCampaignFailure(campaignId, errorMsg);

      // Re-throw to let BullMQ record the failure
      throw error;
    } 
  }

  // ==================== Worker Lifecycle Events ====================

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CampaignJobData>) {
    this.logger.log(
      `Job ${job.id} completed for campaign: ${job.data.campaignId}`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CampaignJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for campaign: ${job.data.campaignId}: ${error.message}`
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job<CampaignJobData>, progress: number | object) {
    const progressValue = typeof progress === 'number' ? progress : 0;
    this.logger.debug(`Job ${job.id} progress: ${progressValue}%`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job<CampaignJobData>) {
    this.logger.log(`Job ${job.id} started for campaign: ${job.data.campaignId}`);
  }

}



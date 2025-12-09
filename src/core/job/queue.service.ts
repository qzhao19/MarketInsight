import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Job, JobsOptions } from "bullmq";
import { AppConfigService } from "../../config/config.service";
import { 
  CampaignJobData, 
  QueueStats, 
  JobStatus 
} from "../../common/types/job/queue.types"

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly defaultPriority: number;
  private readonly maxPriority: number;

  constructor(
    @InjectQueue("campaign-processing")
    private readonly campaignQueue: Queue,
    private readonly configService: AppConfigService,
  ) {
    this.logger.log("QueueService initialized");
    this.defaultPriority = Number(this.configService.queueDefaultPriority) || 5;
    this.maxPriority = Number(this.configService.queueMaxPriority) || 10;
  }

  private normalizePriority(priority?: number): number {
    if (priority === undefined) return this.defaultPriority;
    return Math.max(1, Math.min(this.maxPriority, priority));
  }

  /**
   * Add campaign processing job to queue
   */
  async addCampaignJob(
    campaignId: string,
    userId: string,
    options?: { priority?: number, delay?: number, metadata?: Record<string, any> }
  ): Promise<Job<CampaignJobData>> {
    try {      
      // Validate priority
      const priority = this.normalizePriority(options?.priority);

      const jobData: CampaignJobData = {
        campaignId,
        userId,
        timestamp: new Date().toISOString(),
        metadata: options?.metadata,
      };

      const jobOptions: JobsOptions = {
        jobId: `campaign-${campaignId}`, 
        priority,
        delay: options?.delay,
        removeOnComplete: this.configService.queueKeepCompletedJobs, 
        removeOnFail: this.configService.queueKeepFailedJobs,
      };

      const job = await this.campaignQueue.add("process-campaign", jobData, jobOptions);
      this.logger.log(`Job added: ${job.id} (Campaign: ${campaignId}, Priority: ${priority})`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add job for campaign ${campaignId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Add delayed campaign job 
   */
  async addDelayedCampaignJob(
    campaignId: string,
    userId: string,
    delayMs: number
  ): Promise<Job<CampaignJobData>> {
    if (delayMs < 0) {
      throw new Error("Delay must be a positive number");
    }

    return this.addCampaignJob(campaignId, userId, { delay: delayMs });
  }

  /**
   * Add high-priority campaign job (executed first)
   */
  async addUrgentCampaignJob(
    campaignId: string,
    userId: string
  ): Promise<Job<CampaignJobData>> {
    return this.addCampaignJob(campaignId, userId, { priority: this.maxPriority });
  }

  /**
   * Add low-priority campaign job (executed last)
   */
  async addLowPriorityCampaignJob(
    campaignId: string,
    userId: string
  ): Promise<Job<CampaignJobData>> {
    return this.addCampaignJob(campaignId, userId, { priority: 10 });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    try {
      return (await this.campaignQueue.getJob(jobId)) ?? null;
    } catch (error) {
      this.logger.error(`Failed to get job: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get job by campaign ID
   */
  async getJobByCampaignId(campaignId: string): Promise<Job | null> {
    const jobId = `campaign-${campaignId}`;
    return this.getJob(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();

    return {
      id: job.id!,
      state,
      progress: job.progress as number,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }

  /**
   * Get comprehensive queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.campaignQueue.getWaitingCount(),
        this.campaignQueue.getActiveCount(),
        this.campaignQueue.getCompletedCount(),
        this.campaignQueue.getFailedCount(),
        this.campaignQueue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed }
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Pause the queue (stop processing new jobs)
   */
  async pauseQueue(): Promise<void> {
    await this.campaignQueue.pause();
    this.logger.warn("Campaign queue paused");
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.campaignQueue.resume();
    this.logger.log("Campaign queue resumed");
  }

  /**
   * Remove a specific job
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Job ${jobId} removed`);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(campaignId: string): Promise<void> {
    const jobId = `campaign-${campaignId}`;
    const job = await this.campaignQueue.getJob(jobId);
    if (job && await job.isFailed()) {
      await job.retry();
      this.logger.log(`Retrying job: ${jobId}`);
    }
  }

  /**
   * Clean completed jobs older than specified time
   */
  async cleanCompletedJobs(graceMs = 24 * 60 * 60 * 1000): Promise<string[]> {
    try {
      const jobs = await this.campaignQueue.clean(graceMs, 1000, "completed");
      this.logger.log(`Cleaned ${jobs.length} completed jobs`);
      return jobs;
    } catch (error) {
      this.logger.error(`Failed to clean completed jobs: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Clean failed jobs older than specified time
   * @param graceMs - Grace period in milliseconds (default: 7 days)
   */
  async cleanFailedJobs(graceMs = 7 * 24 * 60 * 60 * 1000): Promise<string[]> {
    try {
      const jobs = await this.campaignQueue.clean(graceMs, 1000, "failed");
      this.logger.log(`Cleaned ${jobs.length} failed jobs`);
      return jobs;
    } catch (error) {
      this.logger.error(`Failed to clean failed jobs: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
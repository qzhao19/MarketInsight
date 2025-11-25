/**
 * Campaign job data interface
 */
export interface CampaignJobData {
  campaignId: string;
  userId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Queue statistics interface
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Job status interface
 */
export interface JobStatus {
  id: string;
  state: string;
  progress: number;
  data: CampaignJobData;
  returnvalue?: any;
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
}
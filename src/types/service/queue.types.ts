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
  paused: number;
}

/**
 * Job status interface
 */
export interface JobStatus {
  id: string;
  state: string;
  progress: number;
  data: any;
  returnvalue?: any;
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
}
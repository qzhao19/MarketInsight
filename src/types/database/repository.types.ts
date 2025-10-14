// ==================== Enums ====================

/**
 * Defines the possible statuses of a task.
 */
export enum TaskStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
};

/**
 * Defines the possible statuses of a marketing campaign.
 */
export enum CampaignStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

/**
 * Defines valid status transitions for campaigns
 */
export const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: [CampaignStatus.ACTIVE, CampaignStatus.ARCHIVED],
  ACTIVE: [CampaignStatus.ARCHIVED],
  ARCHIVED: [],
};


// ==================== LLM Related Types ====================

/**
 * Defines the structure for the input sent to the LLM.
 */
export interface LLMInput {
  prompt: string;
  context?: Record<string, any>;
  // Parameters for the LLM call, e.g., temperature, max_tokens
  modelParameters?: Record<string, any>;
};

/**
 * Defines the structure for the result received from the LLM.
 */
export interface LLMResult {
  rawOutput: string;
  processedOutput?: Record<string, any> | string;
  // metadata from the LLM provider, e.g., token usage, model name
  metadata?: Record<string, any>;
};

// ==================== Entity Interfaces ====================

/**
 * User entity, mirroring the Prisma model.
 */
export interface User {
  id: string;
  email: string;
  username: string;
  // Related campaigns optional
  campaigns?: MarketingCampaign[];
  createdAt: Date; // add this field
  updatedAt: Date; // add this field
  deletedAt?: Date | null; // add this optional/nullable field
  // Note: The password hash should never be included in types used for API responses.
}


/**
 * Task entity, corresponding to the table model in the database.
 */
export interface Task {
  id: string;
  campaignId: string; // Add this foreign key
  campaign?: MarketingCampaign; // Add the related campaign object, make it optional
  status: TaskStatus;
  priority: number;
  input: LLMInput;
  result: LLMResult | null;
  error: string | null; // error message if the task fails.
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Marketing Campaign entity for a Marketing Campaign.
 */
export interface MarketingCampaign {
  id: string;
  userId: string;
  user?: User; // Add the related user object, make it optional
  username: string;
  description: string | null;
  status: CampaignStatus;
  tasks?: Task[]; // Add the related tasks array, make it optional
  createdAt: Date;
  updatedAt: Date;
}



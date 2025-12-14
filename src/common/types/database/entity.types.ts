import { CampaignInput, CampaignResult, TaskResult } from "./llm.types"

// ==================== Enums ====================

// Defines the possible statuses of a task.
export enum TaskStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
};

// Defines the possible statuses of a marketing campaign.
export enum CampaignStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  COMPLETED="COMPLETED",
  ARCHIVED = "ARCHIVED",
}

/**
 * Valid status transitions for campaigns
 * 
 * DRAFT can transition to:
 *   - ACTIVE (user starts the campaign)
 *   - ARCHIVED (user deletes before execution)
 * 
 * ACTIVE can transition to:
 *   - COMPLETED (Agent finishes execution successfully)
 *   - ARCHIVED (user cancels during execution)
 * 
 * COMPLETED can transition to:
 *   - ARCHIVED (user archives after viewing results)
 * 
 * ARCHIVED cannot transition to anything (final state)
 */
export const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: [CampaignStatus.ACTIVE, CampaignStatus.ARCHIVED],
  ACTIVE: [CampaignStatus.COMPLETED, CampaignStatus.ARCHIVED],
  COMPLETED: [CampaignStatus.ARCHIVED],
  ARCHIVED: [],
};

// ==================== Entity Interfaces ====================

// User entity exclude password, mirroring the Prisma model.
export interface SafeUser {
  id: string;
  email: string;
  username: string;
  // Related campaigns optional
  campaigns?: Campaign[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null; // add this optional/nullable field
  // The password hash should never be included in types used for API responses.
}

// Task entity, corresponding to the table model in the database.
export interface Task {
  id: string;
  campaignId: string; // Add this foreign key
  campaign?: Campaign; // Add the related campaign object, make it optional
  status: TaskStatus;
  priority: number;
  result: TaskResult | null;  // TaskExecutionResult
  createdAt: Date;
  updatedAt: Date;
};

// Marketing Campaign entity for a Marketing Campaign.
export interface Campaign {
  id: string;
  userId: string;
  user?: SafeUser; // Add the related user object, make it optional
  name: string;
  description: string | null;
  status: CampaignStatus;
  tasks?: Task[]; // Add the related tasks array, make it optional
  input: CampaignInput;
  result: CampaignResult | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null; 
}

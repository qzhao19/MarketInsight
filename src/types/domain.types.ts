/**
 * defines the possible statuses of a task.
 */
export enum TaskStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
};

/**
 * defines the structure for the input sent to the LLM.
 */
export interface LLMInput {
    prompt: string;
    context?: Record<string, any>;
    // Parameters for the LLM call, e.g., temperature, max_tokens
    modelParameters?: Record<string, any>;
};

/**
 * defines the structure for the result received from the LLM.
 */
export interface LLMResult {
    rawOutput: string;
    processedOutput?: Record<string, any> | string;
    // metadata from the LLM provider, e.g., token usage, model name
    metadata?: Record<string, any>;
};

/**
 * data structure for a task, corresponding to the table model in the database.
 */
export interface Task {
    id: string;
    campaignId: string; // add this foreign key
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
 * API - request body for creating a task.
 */
export type CreateTaskRequest = {
    campaignId: string; // specify which campaign this task belongs to
    input: LLMInput;
    priority?: number;
};

/**
 * API - response body for a task returned to the client.
 */
export type TaskResponse = {
    id: string;
    campaignId: string; // add campaignId to the response
    status: TaskStatus;
    input: LLMInput;
    result: LLMResult | null;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * defines the possible statuses of a marketing campaign.
 */
export enum CampaignStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED',
}

/**
 * data structure for a Marketing Campaign.
 */
export interface MarketingCampaign {
    id: string;
    userId: string;
    user?: User; // Add the related user object, make it optional
    name: string;
    description: string | null;
    status: CampaignStatus;
    tasks?: Task[]; // Add the related tasks array, make it optional
    createdAt: Date;
    updatedAt: Date;
}

/**
 * data structure for a User, mirroring the Prisma model.
 */
export interface User {
    id: string;
    email: string;
    name: string | null;
    campaigns?: MarketingCampaign[]; // add the related campaigns array, make it optional
    createdAt: Date; // add this field
    updatedAt: Date; // add this field
    deletedAt?: Date | null; // add this optional/nullable field
    // Note: The password hash should never be included in types used for API responses.
}

/**
 * NEW: API - response body for user data returned to the client.
 */
export type UserResponse = Omit<User, 'password'>;

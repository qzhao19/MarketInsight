import { 
  Campaign, 
  Task,
  CampaignStatus, 
  TaskStatus 
} from "../../../common/types/database/entity.types"
import { CampaignInput, CampaignResult, TaskResult } from "../../../common/types/database/llm.types"

// ==================== Campaign CRUD Types ====================

// Data required to create a new campaign.
export type CreateCampaignData = {
  userId: string;
  name: string;
  description?: string;
  status?: CampaignStatus;
  input: CampaignInput;
};

// Data for updating an existing campaign.
export type UpdateCampaignData = {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  input?: CampaignInput;
  result?: CampaignResult | null;
};

// ==================== Task CRUD Types ====================

// Data structure for updating a task
export type UpdateTaskData = Partial<{
  status: TaskStatus;
  priority: number;
  result: TaskResult | null;
}>;


// ==================== Query/List Operations ====================

// Sort fields available for campaign queries
type CampaignSortField = "name" | "status" | "createdAt" | "updatedAt";
type TaskSortField = "createdAt" | "updatedAt" | "priority" | "status";

// Options for listing/filtering campaigns with pagination and relations.
export type ListCampaignsOptions = {
  // Pagination options
  skip?: number;
  take?: number;

  // Sorting options
  orderBy?: {
    field: CampaignSortField;
    direction: "asc" | "desc";
  };

  // Filtering conditions for campaigns
  where?: {
    userId?: string;
    status?: CampaignStatus;
    statusIn?: CampaignStatus[]; // Filter by multiple statuses
    name?: string; // Exact match
    nameContains?: string; // Partial match (case-insensitive)
    descriptionContains?: string;
    createdAt?: { gte?: Date; lte?: Date; };
    updatedAt?: { gte?: Date; lte?: Date; };
    hasDescription?: boolean; // true = description is not null/empty
    hasTasks?: boolean; // true = has at least one task
    hasResult?: boolean;
    isDeleted?: boolean; // Filter by soft-deleted status
  };

  // Include related entities
  include?: {
    user?: boolean | {
      select?: {
        id?: boolean;
        username?: boolean;
        email?: boolean;
        createdAt?: boolean;
        updatedAt?: boolean;
      };
    };
    tasks?: boolean | {
      select?: {
        id?: boolean;
        status?: boolean;
        priority?: boolean;
        result?: boolean;
        createdAt?: boolean;
        updatedAt?: boolean;
      };
      where?: {
        status?: TaskStatus;
        statusIn?: TaskStatus[];
        priority?: number;
        priorityRange?: { gte?: number; lte?: number };
        hasResult?: boolean;
      };
      orderBy?: {
        field: TaskSortField;
        direction: "asc" | "desc";
      };
      skip?: number;
      take?: number;
    };
  };
};

/**
 * Options for listing tasks (internal, by campaignId)
 */
export type ListTasksOptions = {
  campaignId: string;
  skip?: number;
  take?: number;

  orderBy?: {
    field: TaskSortField;
    direction: "asc" | "desc";
  };

  where?: {
    status?: TaskStatus;
    statusIn?: TaskStatus[];
    priority?: number;
    priorityRange?: { gte?: number; lte?: number };
    hasResult?: boolean;
    createdAt?: { gte?: Date; lte?: Date };
    updatedAt?: { gte?: Date; lte?: Date };
  };
};

// ==================== Response Types ====================

// Paginated response for campaigns list queries.
export type PaginatedCampaignsResponse = {
  data: Campaign[];
  pagination: {
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
};

// Response type for paginated task list
export type PaginatedTasksResponse = {
  data: Task[];
  pagination: {
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
};

// ==================== Aggregate Types ====================

/**
 * Campaign with execution results - used after Agent completion
 */
export type AggregateCampaignResultData = {
  campaignId: string;
  result: CampaignResult;
  tasks: Array<{
    priority?: number;
    result: TaskResult;
  }>;
};
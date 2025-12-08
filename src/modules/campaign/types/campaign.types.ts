import { 
  Campaign, 
  Task,
  CampaignStatus, 
  TaskStatus,
  SafeUser,
} from "../../../common/types/database/entity.types";
import { 
  CampaignInput, 
  CampaignResult, 
  TaskResult 
} from "../../../common/types/database/llm.types";
import { AgentInvokeOptions } from "../../../common/types/agent/agent.types";

// ==================== Re-export Entity Types ====================
export { Campaign, Task, CampaignStatus, TaskStatus, SafeUser };
export { CampaignInput, CampaignResult, TaskResult };

/**
 * API Layer: Create campaign request from user
 */
export interface CreateCampaignInput {
  userId: string;
  name: string;
  userPrompt: string;
  description?: string;
  priority?: number;
  delay?: number;
  agentInvokeOptions?: AgentInvokeOptions;
}

/**
 * Repository Layer: Data for creating campaign in database
 * Derived from CreateCampaignInput, with input field structured
 */
export interface CreateCampaignData {
  userId: string;
  name: string;
  description?: string;
  status?: CampaignStatus;
  input: CampaignInput;
}

/**
 * Repository Layer: Data for updating campaign
 */
export interface UpdateCampaignData {
  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  input?: CampaignInput;
  result?: CampaignResult | null;
}

/**
 * Repository Layer: Data for updating task
 */
export interface UpdateTaskData {
  status?: TaskStatus;
  priority?: number;
  result?: TaskResult | null;
}

/**
 * Repository Layer: Aggregate data for completing campaign with tasks
 * Used by CampaignProcessor after Agent execution
 */
export interface AggregateCampaignResultData {
  campaignId: string;
  result: CampaignResult;
  tasks: Array<{
    priority?: number;
    result: TaskResult;
  }>;
}

// ==================== Query Options ====================

type CampaignSortField = "name" | "status" | "createdAt" | "updatedAt";
type TaskSortField = "createdAt" | "updatedAt" | "priority" | "status";

/**
 * Common sort options
 */
interface SortOptions<T extends string> {
  field: T;
  direction: "asc" | "desc";
}

/**
 * Common pagination options
 */
interface PaginationOptions {
  skip?: number;
  take?: number;
}

/**
 * Campaign filter options
 */
export interface CampaignWhereOptions {
  userId?: string;
  status?: CampaignStatus;
  statusIn?: CampaignStatus[];
  name?: string;
  nameContains?: string;
  descriptionContains?: string;
  createdAt?: { gte?: Date; lte?: Date };
  updatedAt?: { gte?: Date; lte?: Date };
  hasDescription?: boolean;
  hasTasks?: boolean;
  hasResult?: boolean;
  isDeleted?: boolean;
}

/**
 * Task filter options
 */
export interface TaskWhereOptions {
  status?: TaskStatus;
  statusIn?: TaskStatus[];
  priority?: number;
  priorityRange?: { gte?: number; lte?: number };
  hasResult?: boolean;
  createdAt?: { gte?: Date; lte?: Date };
  updatedAt?: { gte?: Date; lte?: Date };
}

/**
 * Options for listing campaigns
 */
export interface ListCampaignsOptions extends PaginationOptions {
  orderBy?: SortOptions<CampaignSortField>;
  where?: CampaignWhereOptions;
  include?: {
    user?: boolean | { select?: Partial<Record<keyof SafeUser, boolean>> };
    tasks?: boolean | {
      select?: Partial<Record<keyof Task, boolean>>;
      where?: TaskWhereOptions;
      orderBy?: SortOptions<TaskSortField>;
      skip?: number;
      take?: number;
    };
  };
}

/**
 * Options for listing tasks by campaign
 */
export interface ListTasksOptions extends PaginationOptions {
  campaignId: string;
  orderBy?: SortOptions<TaskSortField>;
  where?: TaskWhereOptions;
}

// ==================== Response Types ====================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
  totalPages: number;
  currentPage: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Paginated campaigns response
 */
export type PaginatedCampaignsResponse = PaginatedResponse<Campaign>;

/**
 * Paginated tasks response
 */
export type PaginatedTasksResponse = PaginatedResponse<Task>;

/**
 * Campaign with tasks (guaranteed to have tasks array)
 */
export interface CampaignWithTasks extends Campaign {
  tasks: Task[];
}

/**
 * Campaign progress information
 */
export interface CampaignProgress {
  campaignId: string;
  status: CampaignStatus;
  message: string;
  taskStats?: {
    total: number;
    completed: number;
    failed: number;
  };
}
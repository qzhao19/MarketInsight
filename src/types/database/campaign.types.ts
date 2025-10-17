import { 
  Campaign, 
  CampaignStatus, 
  LLMInput, 
  TaskStatus,
} from "./entities.types";

// Data required to create a new campaign.
export type CreateCampaignData = {
  userId: string;
  name: string;
  description?: string;
  status?: CampaignStatus;
  tasks?: Array<{
    input: LLMInput;
    priority?: number;
    status?: TaskStatus;
  }>;
};

// Data for updating an existing campaign.
export type UpdateCampaignData = {
  name?: string;
  description?: string;
  status?: CampaignStatus;
};

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
    createdAt?: {
      gte?: Date;
      lte?: Date;
    };
    updatedAt?: {
      gte?: Date;
      lte?: Date;
    };
    hasDescription?: boolean; // true = description is not null/empty
    hasTasks?: boolean; // true = has at least one task
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
        input?: boolean;
        result?: boolean;
        error?: boolean;
        createdAt?: boolean;
        updatedAt?: boolean;
      };
      where?: {
        status?: TaskStatus;
        statusIn?: TaskStatus[];
        priority?: number;
        priorityRange?: { gte?: number; lte?: number };
        hasError?: boolean;
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


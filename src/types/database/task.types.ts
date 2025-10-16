import { 
  LLMInput, 
  TaskStatus, 
  LLMResult, 
  Task, 
} from "./repository.types";

//  Repository Operation Types 

// Data structure for creating a new task
export type CreateTaskData = {
  campaignId: string;
  input: LLMInput;
  priority?: number;   // Default: 1
  status?: TaskStatus; // default is PENDING
};

// Data structure for updating a task
export type UpdateTaskData = Partial<{
  status: TaskStatus;
  priority: number;
  input: LLMInput;
  result: LLMResult | null;
  error: string | null;
}>;

//  List/Query Types 

// Sort fields available for task queries
type TaskSortField = "createdAt" | "updatedAt" | "priority" | "status";

// Options for listing tasks with pagination, filtering, and relations
export type ListTasksOptions = {
  // Pagination 
  skip?: number;           // Number of records to skip (default: 0)
  take?: number;           // Number of records to return (default: 20, max: 100)

  // Sorting 
  orderBy?: {
    field: TaskSortField;
    direction: "asc" | "desc";
  };

  // Filtering 
  where?: {
    // Basic filters
    campaignId?: string;   // Filter by campaign ID
    status?: TaskStatus;   // Filter by task status
    priority?: number;     // Filter by exact priority
    
    // Range filters
    priorityRange?: {
      gte?: number;        // Priority >= value
      lte?: number;        // Priority <= value
    };
    
    createdAt?: {
      gte?: Date;          // Created after or on this date
      lte?: Date;          // Created before or on this date
    };
    
    updatedAt?: {
      gte?: Date;          // Updated after or on this date
      lte?: Date;          // Updated before or on this date
    };

    // Advanced filters
    hasError?: boolean;    // Filter tasks with/without errors (error IS NOT NULL / IS NULL)
    hasResult?: boolean;   // Filter tasks with/without results (result IS NOT NULL / IS NULL)
    searchError?: string;  // Search in error message (case-insensitive)
  };

  // Relations 
  include?: {
    campaign?: boolean | {
      // Select specific campaign fields
      select?: {
        id?: boolean;
        name?: boolean;
        description?: boolean;
        status?: boolean;
        userId?: boolean;
        createdAt?: boolean;
        updatedAt?: boolean;
      };
    };
  };
};

// Response type for paginated task list
export type PaginatedTasksResponse = {
  data: Task[];
  pagination: {
    total: number;         // Total number of tasks matching the filter
    skip: number;          // Number of records skipped
    take: number;          // Number of records returned
    hasMore: boolean;      // Whether there are more records
    totalPages: number;    // Total number of pages
    currentPage: number;   // Current page number (1-indexed)
  };
};

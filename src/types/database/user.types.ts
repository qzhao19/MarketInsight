import { SafeUser } from "./entities.types";

// Define more specific types for method inputs to improve clarity and type safety.
export type CreateUserData = {
    email: string;
    username: string;
    password: string;
};

// Data structure for updating user information
export type UpdateUserData = {
  email?: string;
  username?: string;
  // New hashed password
  password?: string;
};

// ==================== List/Query Types ====================

// Sort fields available for user queries
type UserSortField = "createdAt" | "updatedAt" | "email" | "username";

// Options for listing users with pagination and filtering
export type ListUsersOptions = {
  // Pagination
  skip?: number;
  take?: number;

  // Sorting
  orderBy?: {
    field: UserSortField;
    direction: "asc" | "desc";
  };

  // Filtering
  where?: {
    email?: string;           // Exact match
    username?: string;        // Exact match
    searchTerm?: string;      // Search in email or username
    includeDeleted?: boolean; // Include soft-deleted users
  };

  // Relations
  include?: {
    campaigns?: boolean | {
      take?: number;          // Limit number of campaigns
      orderBy?: "createdAt" | "updatedAt";
      where?: {     
        status?: string;      // Filter campaigns by status
      };
    };
  };
};

// Response type for paginated user list
export type PaginatedUsersResponse = {
  data: SafeUser[];
  pagination: {
    total: number;       // Total number of users matching the filter
    skip: number;        // Number of records skipped
    take: number;        // Number of records returned
    hasMore: boolean;    // Whether there are more records
    totalPages: number;  // Total number of pages
    currentPage: number; // Current page number (1-indexed)
  };
};


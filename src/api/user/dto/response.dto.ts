import { Exclude, Expose, Transform } from "class-transformer";
import { SafeUser } from "../../../types/database/entities.types";
import { TokenData } from "../../../types/api/dto.types"
// ==================== User Response DTO ====================

/**
 * Base response DTO
 */
abstract class BaseResponseDto {
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  createdAt: string;

  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  updatedAt: string;
}

/**
 * Standard user response DTO for client
 */
export class ClientUserResponseDto extends BaseResponseDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  email: string;

  // Note: password is never exposed
  @Exclude()
  password?: string;

  /**
   * Creates a UserResponseDto from a User entity
   */
  static fromEntity(user: SafeUser): ClientUserResponseDto {
    const dto = new ClientUserResponseDto();
    dto.id = user.id;
    dto.username = user.username;
    dto.email = user.email;
    dto.createdAt = user.createdAt instanceof Date
      ? user.createdAt.toISOString()
      : user.createdAt;
    dto.updatedAt = user.updatedAt instanceof Date 
      ? user.updatedAt.toISOString() 
      : user.updatedAt;
    return dto;
  }

  /**
   * Creates an array of UserResponseDto from User entities
   */
  static fromEntities(users: SafeUser[]): ClientUserResponseDto[] {
    return users.map(user => ClientUserResponseDto.fromEntity(user));
  }
}

// ==================== Login Response DTO ====================

/**
 * Token type constants
 */
const TOKEN_TYPE = {
  BEARER: "Bearer",
} as const;

/**
 * Response DTO for login
 */
export class LoginResponseDto {
  @Expose()
  user: ClientUserResponseDto;

  @Expose()
  accessToken: string;

  @Expose()
  refreshToken?: string;

  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  expiresAt: string;

  @Expose()
  tokenType: string;

  /**
   * Creates a LoginResponseDto from user and token data
   */
  static fromLogin(user: SafeUser, tokens: TokenData): LoginResponseDto {
    const response = new LoginResponseDto();
    response.user = ClientUserResponseDto.fromEntity(user);
    response.accessToken = tokens.accessToken;
    response.refreshToken = tokens.refreshToken;
    
    // Calculate expiration time
    const expirationDate = new Date(Date.now() + tokens.expiresIn * 1000);
    response.expiresAt = expirationDate.toISOString();
    
    response.tokenType = TOKEN_TYPE.BEARER;
    return response;
  }
}

// ==================== User Statistics DTO ====================

/**
 * Statistics data structure
 */
export interface UserStatsData {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks?: number;
  totalCampaigns: number;
  activeCampaigns: number;
  draftCampaigns?: number;
  archivedCampaigns?: number;
  lastActivityAt?: Date;
  averageCompletionTimeMs?: number; // in milliseconds
}

/**
 * User statistics response DTO
 */
export class UserStatsResponseDto {
  @Expose()
  userId: string;

  @Expose()
  totalTasks: number;

  @Expose()
  completedTasks: number;

  @Expose()
  failedTasks: number;

  @Expose()
  pendingTasks: number;

  @Expose()
  totalCampaigns: number;

  @Expose()
  activeCampaigns: number;

  @Expose()
  draftCampaigns: number;

  @Expose()
  archivedCampaigns: number;

  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  lastActivityAt?: string | null;

  @Expose()
  successRate: number;

  @Expose()
  failureRate: number;

  @Expose()
  averageCompletionTime: string;

  /**
   * Creates a UserStatsResponseDto from user ID and stats data
   * 
   * const statsDto = UserStatsResponseDto.fromStats("user-123", {
   *   totalTasks: 100,
   *   completedTasks: 80,
   *   failedTasks: 15,
   *   pendingTasks: 5,
   *   totalCampaigns: 10,
   *   activeCampaigns: 3,
   *   lastActivityAt: new Date(),
   *   averageCompletionTimeMs: 5400000 // 1.5 hours
   * });
   */
  static fromStats(userId: string, stats: UserStatsData): UserStatsResponseDto {
    const dto = new UserStatsResponseDto();
    
    dto.userId = userId;
    dto.totalTasks = stats.totalTasks;
    dto.completedTasks = stats.completedTasks;
    dto.failedTasks = stats.failedTasks;
    dto.pendingTasks = stats.pendingTasks ?? 0;
    dto.totalCampaigns = stats.totalCampaigns;
    dto.activeCampaigns = stats.activeCampaigns;
    dto.draftCampaigns = stats.draftCampaigns ?? 0;
    dto.archivedCampaigns = stats.archivedCampaigns ?? 0;

    // Calculate success rate (percentage with 2 decimal places)
    if (stats.totalTasks === 0) {
      dto.successRate = 0;
      dto.failureRate = 0;
    } else {
      dto.successRate = Math.round((stats.completedTasks / stats.totalTasks) * 10000) / 100;
      dto.failureRate = Math.round((stats.failedTasks / stats.totalTasks) * 10000) / 100;
    }

    // Format average completion time
    dto.averageCompletionTime = this.formatCompletionTime(stats.averageCompletionTimeMs);

    // Format last activity time
    if (stats.lastActivityAt) {
      dto.lastActivityAt = stats.lastActivityAt instanceof Date
        ? stats.lastActivityAt.toISOString()
        : stats.lastActivityAt;
    }

    return dto;
  }

  /**
   * Formats completion time from milliseconds to human-readable format
   */
  private static formatCompletionTime(timeMs?: number): string {
    if (!timeMs || timeMs === 0) {
      return "N/A";
    }

    const seconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// ==================== Paginated Response DTO ====================

/**
 * Pagination metadata
 */
export class PaginationMetadata {
  @Expose()
  total: number;

  @Expose()
  skip: number;

  @Expose()
  take: number;

  @Expose()
  hasMore: boolean;

  @Expose()
  totalPages: number;

  @Expose()
  currentPage: number;
}

/**
 * Generic paginated response wrapper
 */
export class PaginatedClientUsersResponseDto {
  @Expose()
  data: ClientUserResponseDto[];

  @Expose()
  pagination: PaginationMetadata;

  /**
   * Creates a paginated response from users and pagination metadata
   */
  static fromPaginated(
    users: SafeUser[],
    pagination: PaginationMetadata
  ): PaginatedClientUsersResponseDto {
    const response = new PaginatedClientUsersResponseDto();
    response.data = ClientUserResponseDto.fromEntities(users);
    response.pagination = pagination;
    return response;
  }
}


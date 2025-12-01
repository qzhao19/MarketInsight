import { Expose, Transform } from "class-transformer";

/**
 * Statistics data structure for user
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
  averageCompletionTimeMs?: number;
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

    dto.averageCompletionTime = this.formatCompletionTime(stats.averageCompletionTimeMs);

    // Format last activity time
    if (stats.lastActivityAt) {
      dto.lastActivityAt = stats.lastActivityAt instanceof Date
        ? stats.lastActivityAt.toISOString()
        : String(stats.lastActivityAt);
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
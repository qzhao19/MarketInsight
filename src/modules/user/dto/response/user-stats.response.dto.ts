import { Expose, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
  @ApiProperty({
    description: "User unique identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @Expose()
  userId: string;

  @ApiProperty({
    description: "Total number of tasks created by the user",
    example: 150,
  })
  @Expose()
  totalTasks: number;

  @ApiProperty({
    description: "Number of completed tasks",
    example: 120,
  })
  @Expose()
  completedTasks: number;

  @ApiProperty({
    description: "Number of failed tasks",
    example: 15,
  })
  @Expose()
  failedTasks: number;

  @ApiProperty({
    description: "Number of pending tasks",
    example: 15,
  })
  @Expose()
  pendingTasks: number;

  @ApiProperty({
    description: "Total number of campaigns created by the user",
    example: 12,
  })
  @Expose()
  totalCampaigns: number;

  @ApiProperty({
    description: "Number of active campaigns",
    example: 3,
  })
  @Expose()
  activeCampaigns: number;

  @ApiProperty({
    description: "Number of draft campaigns",
    example: 2,
  })
  @Expose()
  draftCampaigns: number;

  @ApiProperty({
    description: "Number of archived campaigns",
    example: 7,
  })
  @Expose()
  archivedCampaigns: number;

  @ApiPropertyOptional({
    description: "Last activity timestamp (ISO 8601)",
    example: "2024-01-15T10:30:00.000Z",
  })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  lastActivityAt?: string | null;

  @ApiProperty({
    description: "Task success rate as percentage (0-100)",
    example: 80.0,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  successRate: number;

  @ApiProperty({
    description: "Task failure rate as percentage (0-100)",
    example: 10.0,
    minimum: 0,
    maximum: 100,
  })
  @Expose()
  failureRate: number;

  @ApiProperty({
    description: "Average task completion time in human-readable format",
    example: "1h 30m",
  })
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
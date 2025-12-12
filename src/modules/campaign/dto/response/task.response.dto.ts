import { Expose, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TaskStatus, Task } from "../../../../common/types/database/entity.types";
import { PaginationMetaDto } from "./campaign.response.dto";

/**
 * DTO for task response
 */
export class TaskResponseDto {
  @ApiProperty({ description: "Task ID", example: "task-123" })
  @Expose()
  id: string;

  @ApiProperty({ description: "Campaign ID", example: "campaign-123" })
  @Expose()
  campaignId: string;

  @ApiProperty({ 
    description: "Task status", 
    enum: TaskStatus, 
    example: TaskStatus.COMPLETED 
  })
  @Expose()
  status: TaskStatus;

  @ApiProperty({ description: "Task priority (lower = higher priority)", example: 1 })
  @Expose()
  priority: number;

  @ApiPropertyOptional({ description: "Task result (only available when completed)" })
  @Expose()
  result: any | null;

  @ApiProperty({ description: "Creation timestamp", example: "2024-12-09T10:00:00Z" })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp", example: "2024-12-09T10:30:00Z" })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Associated campaign information" })
  @Expose()
  campaign?: any;

  /**
   * Creates a TaskResponseDto from a Task entity
   */
  static fromEntity(task: Task): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = task.id;
    dto.campaignId = task.campaignId;
    dto.status = task.status;
    dto.priority = task.priority;
    dto.result = task.result;
    dto.createdAt = task.createdAt instanceof Date 
      ? task.createdAt 
      : new Date(task.createdAt);
    dto.updatedAt = task.updatedAt instanceof Date 
      ? task.updatedAt 
      : new Date(task.updatedAt);
    dto.campaign = task.campaign || undefined;
    return dto;
  }

  static fromEntities(tasks: Task[]): TaskResponseDto[] {
    return tasks.map(task => TaskResponseDto.fromEntity(task));
  }
}

/**
 * DTO for task list response
 */
export class TaskListResponseDto {
  @ApiProperty({ description: "List of tasks", type: [TaskResponseDto] })
  @Expose()
  data: TaskResponseDto[];

  @ApiProperty({ description: "Pagination metadata", type: PaginationMetaDto })
  @Expose()
  pagination: PaginationMetaDto;
}

import { 
  IsString, 
  IsOptional, 
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CampaignStatus, TaskStatus } from "../../../../common/types/database/entity.types";

/**
 * DTO for pagination query parameters
 */
export class PaginationQueryDto {
  // Number of items to skip
  @ApiPropertyOptional({
    description: "Number of items to skip",
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  skip?: number = 0;

  // Number of items to take
  @ApiPropertyOptional({
    description: "Number of items to take",
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  take?: number = 20;
}

/**
 * DTO for campaign list filters
 */
export class ListCampaignsQueryDto extends PaginationQueryDto {
  // Filter by campaign status
  @ApiPropertyOptional({
    description: "Filter by campaign status",
    enum: CampaignStatus,
    example: CampaignStatus.ACTIVE,
  })
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;

  // Filter by multiple statuses
  @ApiPropertyOptional({
    description: "Filter by multiple statuses",
    enum: CampaignStatus,
    isArray: true,
    example: [CampaignStatus.ACTIVE, CampaignStatus.ARCHIVED],
  })
  @IsArray()
  @IsEnum(CampaignStatus, { each: true })
  @IsOptional()
  statusIn?: CampaignStatus[];

  // Filter by exact campaign name
  @ApiPropertyOptional({
    description: "Filter by exact campaign name",
    example: "Q4 2024 Marketing Analysis",
  })
  @IsString()
  @IsOptional()
  name?: string;

  // Filter by campaign name containing text
  @ApiPropertyOptional({
    description: "Filter by campaign name containing text",
    example: "Marketing",
  })
  @IsString()
  @IsOptional()
  nameContains?: string;

  // Filter by description containing text
  @ApiPropertyOptional({
    description: "Filter by description containing text",
    example: "EV market",
  })
  @IsString()
  @IsOptional()
  descriptionContains?: string;

  // Filter campaigns with/without description
  @ApiPropertyOptional({
    description: "Filter campaigns with/without description",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  hasDescription?: boolean;

  // Filter campaigns with/without tasks
  @ApiPropertyOptional({
    description: "Filter campaigns with/without tasks",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  hasTasks?: boolean;

  // Filter campaigns with/without results
  @ApiPropertyOptional({
    description: "Filter campaigns with/without results",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  hasResult?: boolean;

  // Include user information
  @ApiPropertyOptional({
    description: "Include user information",
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeUser?: boolean = false;

  // Include tasks information
  @ApiPropertyOptional({
    description: "Include tasks information",
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeTasks?: boolean = false;

  // description: "Sort field": ["name", "status", "createdAt", "updatedAt"],
  @ApiPropertyOptional({
    description: "Sort field",
    enum: ["name", "status", "createdAt", "updatedAt"],
    example: "createdAt",
    default: "createdAt",
  })
  @IsString()
  @IsOptional()
  sortBy?: "name" | "status" | "createdAt" | "updatedAt" = "createdAt";

  // ort direction: "asc", "desc"
  @ApiPropertyOptional({
    description: "Sort direction",
    enum: ["asc", "desc"],
    example: "desc",
    default: "desc",
  })
  @IsString()
  @IsOptional()
  sortOrder?: "asc" | "desc" = "desc";
}

/**
 * DTO for listing tasks of a campaign
 */
export class ListTasksQueryDto extends PaginationQueryDto {
  // Filter by task status
  @ApiPropertyOptional({
    description: "Filter by task status",
    enum: TaskStatus,
    example: TaskStatus.SUCCESS,
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  // Filter by multiple statuses
  @ApiPropertyOptional({
    description: "Filter by multiple task statuses",
    enum: TaskStatus,
    isArray: true,
    example: [TaskStatus.SUCCESS, TaskStatus.FAILED],
  })
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  @IsOptional()
  statusIn?: TaskStatus[];

  // Sort field: createdAt", "updatedAt", "priority", "status"
  @ApiPropertyOptional({
    description: "Sort field",
    enum: ["createdAt", "updatedAt", "priority", "status"],
    example: "priority",
    default: "createdAt",
  })
  @IsString()
  @IsOptional()
  sortBy?: "createdAt" | "updatedAt" | "priority" | "status" = "createdAt";

  // Sort direction: asc", "desc"
  @ApiPropertyOptional({
    description: "Sort direction",
    enum: ["asc", "desc"],
    example: "asc",
    default: "desc",
  })
  @IsString()
  @IsOptional()
  sortOrder?: "asc" | "desc" = "desc";
}


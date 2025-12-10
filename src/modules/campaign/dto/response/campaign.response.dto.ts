import { Expose, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CampaignStatus, Campaign } from "../../../../common/types/database/entity.types";

/**
 * DTO for pagination metadata in responses
 */
export class PaginationMetaDto {
  @ApiProperty({ description: "Total number of items", example: 100 })
  @Expose()
  total: number;

  @ApiProperty({ description: "Number of items skipped", example: 0 })
  @Expose()
  skip: number;

  @ApiProperty({ description: "Number of items taken", example: 20 })
  @Expose()
  take: number;

  @ApiProperty({ description: "Whether there are more items", example: true })
  @Expose()
  hasMore: boolean;

  @ApiProperty({ description: "Total number of pages", example: 5 })
  @Expose()
  totalPages: number;

  @ApiProperty({ description: "Current page number", example: 1 })
  @Expose()
  currentPage: number;

}

/**
 * DTO for campaign response
 */
export class CampaignResponseDto {
  @ApiProperty({ description: "Campaign ID", example: "clx123abc456" })
  @Expose()
  id: string;

  @ApiProperty({ description: "User ID", example: "user_123" })
  @Expose()
  userId: string;

  @ApiProperty({ description: "Campaign name", example: "Q4 2024 Marketing Analysis" })
  @Expose()
  name: string;

  @ApiPropertyOptional({ description: "Campaign description", example: "Comprehensive market analysis" })
  @Expose()
  description: string | null;

  @ApiProperty({ description: "Campaign status", enum: CampaignStatus, example: CampaignStatus.ACTIVE })
  @Expose()
  status: CampaignStatus;

  @ApiProperty({ description: "Campaign input data" })
  @Expose()
  input: {
    userPrompt: string;
    userContext?: Record<string, any>;
  };

  @ApiPropertyOptional({ description: "Campaign result (only available when completed)" })
  @Expose()
  result: any | null;

  @ApiProperty({ description: "Creation timestamp", example: "2024-12-09T10:00:00Z" })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp", example: "2024-12-09T10:30:00Z" })
  @Expose()
  @Type(() => Date)  updatedAt: Date;

  @ApiPropertyOptional({ description: "Associated tasks" })
  @Expose()
  tasks?: any[];

  @ApiPropertyOptional({ description: "Associated user information" })
  @Expose()
  user?: any;

  /**
   * Creates a CampaignResponseDto from a Campaign entity
   */
  static fromEntity(campaign: Campaign): CampaignResponseDto {
    const dto = new CampaignResponseDto();
    dto.id = campaign.id;
    dto.userId = campaign.userId;
    dto.name = campaign.name;
    dto.description = campaign.description;
    dto.status = campaign.status;
    dto.input = campaign.input;
    dto.result = campaign.result;
    dto.createdAt = campaign.createdAt instanceof Date 
      ? campaign.createdAt 
      : new Date(campaign.createdAt);
    dto.updatedAt = campaign.updatedAt instanceof Date 
      ? campaign.updatedAt 
      : new Date(campaign.updatedAt);
    dto.tasks = campaign.tasks || undefined;
    dto.user = campaign.user || undefined;
    return dto;
  }

  static fromEntities(campaigns: Campaign[]): CampaignResponseDto[] {
    return campaigns.map(campaign => CampaignResponseDto.fromEntity(campaign));
  }
}

/**
 * DTO for campaign list response
 */
export class CampaignListResponseDto {
  @ApiProperty({ description: "List of campaigns", type: [CampaignResponseDto] })
  @Expose()
  data: CampaignResponseDto[];

  @ApiProperty({ description: "Pagination metadata", type: PaginationMetaDto })
  @Expose()
  pagination: PaginationMetaDto;
}

/**
 * DTO for campaign progress response
 */
export class CampaignProgressResponseDto {
  @ApiProperty({ description: "Campaign ID", example: "clx123abc456" })
  @Expose()
  campaignId: string;

  @ApiProperty({ description: "Current status", enum: CampaignStatus, example: CampaignStatus.ACTIVE })
  @Expose()
  status: CampaignStatus;

  @ApiProperty({ description: "Progress message", example: "Processing... 45%" })
  @Expose()
  message: string;

  @ApiPropertyOptional({ description: "Task statistics" })
  @Expose()
  taskStats?: {
    total: number;
    completed: number;
    failed: number;
  };
}


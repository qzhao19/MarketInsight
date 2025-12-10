import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsObject, 
  MinLength, 
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LLModelConfigDto, TaskExecutionConfigDto } from "./agent-options.request.dto";

/**
 * DTO for creating a new campaign
 */
export class CreateCampaignDto {
  @ApiProperty({
    description: "Campaign name",
    example: "Q4 2024 Marketing Analysis",
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: "Campaign name must be at least 3 characters" })
  @MaxLength(300, { message: "Campaign name cannot exceed 300 characters" })
  name: string;

  @ApiProperty({
    description: "User prompt for the marketing research",
    example: "Analyze the electric vehicle market trends in North America for Q4 2024",
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: "User prompt must be at least 10 characters" })
  @MaxLength(2000, { message: "User prompt cannot exceed 2000 characters" })
  userPrompt: string;

  @ApiPropertyOptional({
    description: "Optional campaign description",
    example: "Comprehensive market analysis focusing on EV adoption rates and consumer preferences",
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: "Description cannot exceed 500 characters" })
  description?: string;

  @ApiPropertyOptional({
    description: "Additional user context for Agent execution",
    example: { 
      industry: "automotive", 
      region: "North America",
      timeframe: "Q4 2024",
    },
  })
  @IsObject()
  @IsOptional()
  userContext?: Record<string, any>;

  // LLM model configuration
  @ApiPropertyOptional({
    description: "LLM model configuration",
    type: LLModelConfigDto,
  })
  @ValidateNested()
  @Type(() => LLModelConfigDto)
  @IsOptional()
  modelConfig?: LLModelConfigDto;

  // Task execution configuration
  @ApiPropertyOptional({
    description: "Task execution configuration",
    type: TaskExecutionConfigDto,
  })
  @ValidateNested()
  @Type(() => TaskExecutionConfigDto)
  @IsOptional()
  taskExecutionConfig?: TaskExecutionConfigDto;
};






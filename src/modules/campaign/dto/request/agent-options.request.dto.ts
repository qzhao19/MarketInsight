import { 
  IsString, 
  IsOptional, 
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * DTO for LLM model configuration
 */
export class LLModelConfigDto {
  // Model name or identifier
  @ApiPropertyOptional({
    description: "Model name or identifier",
    example: "deepseek-chat",
  })
  @IsString()
  @IsOptional()
  model?: string;

  // Controls randomness (0-2). Lower = more deterministic
  @ApiPropertyOptional({
    description: "Controls randomness (0-2). Lower = more deterministic",
    example: 0.7,
    minimum: 0,
    maximum: 2,
  })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  // Nucleus sampling parameter (0-1)
  @ApiPropertyOptional({
    description: "Nucleus sampling parameter (0-1)",
    example: 0.9,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  topP?: number;

  // Frequency penalty (-2 to 2)
  @ApiPropertyOptional({
    description: "Frequency penalty (-2 to 2)",
    example: 0,
    minimum: -2,
    maximum: 2,
  })
  @IsNumber()
  @Min(-2)
  @Max(2)
  @IsOptional()
  frequencyPenalty?: number;

  // Presence penalty (-2 to 2)
  @ApiPropertyOptional({
    description: "Presence penalty (-2 to 2)",
    example: 0,
    minimum: -2,
    maximum: 2,
  })
  @IsNumber()
  @Min(-2)
  @Max(2)
  @IsOptional()
  presencePenalty?: number;

  // Maximum tokens to generate
  @ApiPropertyOptional({
    description: "Maximum tokens to generate",
    example: 4096,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

  // Maximum concurrent requests
  @ApiPropertyOptional({
    description: "Maximum concurrent requests",
    example: 5,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxConcurrency?: number;

  // Maximum retry attempts
  @ApiPropertyOptional({
    description: "Maximum retry attempts",
    example: 3,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxRetries?: number;

  // Request timeout in milliseconds
  @ApiPropertyOptional({
    description: "Request timeout in milliseconds",
    example: 60000,
    minimum: 1000,
  })
  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout?: number;

  // Enable streaming (0 or 1)
  @ApiPropertyOptional({
    description: "Enable streaming (0 or 1)",
    example: 0,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  streaming?: number;

  // Enable verbose logging (0 or 1)
  @ApiPropertyOptional({
    description: "Enable verbose logging (0 or 1)",
    example: 0,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  verbose?: number;
}

/**
 * DTO for task execution configuration
 */
export class TaskExecutionConfigDto {
  // Maximum queries to optimize per task
  @ApiPropertyOptional({
    description: "Maximum queries to optimize per task",
    example: 6,
    minimum: 1,
    maximum: 20,
    default: 6,
  })
  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  maxQueriesPerTask?: number;

  // Search timeout in milliseconds
  @ApiPropertyOptional({
    description: "Search timeout in milliseconds",
    example: 20000,
    minimum: 5000,
    maximum: 60000,
    default: 20000,
  })
  @IsNumber()
  @Min(5000)
  @Max(60000)
  @IsOptional()
  searchTimeout?: number;

  // Maximum retries for failed searches
  @ApiPropertyOptional({
    description: "Maximum retries for failed searches",
    example: 3,
    minimum: 0,
    maximum: 5,
    default: 3,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  maxRetries?: number;

  // Execute searches in parallel
  @ApiPropertyOptional({
    description: "Execute searches in parallel",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  parallelSearches?: boolean;
}

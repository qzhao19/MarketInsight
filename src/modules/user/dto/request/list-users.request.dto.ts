import { 
  IsOptional, 
  IsInt, 
  Min, 
  Max, 
  IsString, 
  IsBoolean, 
  IsIn, 
  ValidateNested,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Sort order configuration for user listing
 */
class UserSortOrderDto {
  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: ["createdAt", "updatedAt", "email", "username"],
    example: "createdAt",
    default: "createdAt",
  })
  @IsIn(["createdAt", "updatedAt", "email", "username"])
  field: "createdAt" | "updatedAt" | "email" | "username" = "createdAt";

  @ApiPropertyOptional({
    description: "Sort direction",
    enum: ["asc", "desc"],
    example: "desc",
    default: "desc",
  })
  @IsIn(["asc", "desc"])
  direction: "asc" | "desc" = "desc";
}

/**
 * Filter options for user listing
 */
class UserFilterDto {
  @ApiPropertyOptional({
    description: "Filter by exact email address",
    example: "john.doe@example.com",
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: "Filter by exact username",
    example: "johndoe",
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: "Search term for email or username (partial match)",
    example: "john",
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({
    description: "Include soft-deleted users in results",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  includeDeleted?: boolean;
}

/**
 * Data Transfer Object for listing users with pagination, sorting and filtering
 */
export class ListUsersRequestDto {
  @ApiPropertyOptional({
    description: "Number of users to skip (for pagination)",
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional({
    description: "Number of users to return (page size)",
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({
    description: "Sort configuration",
    type: UserSortOrderDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserSortOrderDto)
  orderBy?: UserSortOrderDto;

  @ApiPropertyOptional({
    description: "Filter configuration",
    type: UserFilterDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserFilterDto)
  where?: UserFilterDto;
}
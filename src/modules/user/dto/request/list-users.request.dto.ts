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

/**
 * Sort order configuration for user listing
 */
class UserSortOrderDto {
  @IsIn(["createdAt", "updatedAt", "email", "username"])
  field: "createdAt" | "updatedAt" | "email" | "username" = "createdAt";

  @IsIn(["asc", "desc"])
  direction: "asc" | "desc" = "desc";
}

/**
 * Filter options for user listing
 */
class UserFilterDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  searchTerm?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  includeDeleted?: boolean;
}

/**
 * Data Transfer Object for listing users with pagination, sorting and filtering
 */
export class ListUsersRequestDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 20;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserSortOrderDto)
  orderBy?: UserSortOrderDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserFilterDto)
  where?: UserFilterDto;
}
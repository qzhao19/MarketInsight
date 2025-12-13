import { Expose } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "./user.response.dto";
import { SafeUser } from "../../../../common/types/database/entity.types";

/**
 * Pagination metadata
 */
export class PaginationMeta {
  @ApiProperty({ description: "Total number of users", example: 100 })
  @Expose()
  total: number;

  @ApiProperty({ description: "Number of users skipped", example: 0 })
  @Expose()
  skip: number;

  @ApiProperty({ description: "Number of users returned", example: 20 })
  @Expose()
  take: number;

  @ApiProperty({ description: "Whether more users are available", example: true })
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
 * Paginated users response DTO
 */
export class PaginatedUsersResponseDto {
  @ApiProperty({
    description: "Array of users",
    type: [UserResponseDto],
  })
  @Expose()
  data: UserResponseDto[];

  @ApiProperty({
    description: "Pagination metadata",
    type: PaginationMeta,
  })
  @Expose()
  pagination: PaginationMeta;

  /**
   * Creates a paginated response from users and pagination metadata
   */
  static fromPaginated(
    users: SafeUser[],
    pagination: PaginationMeta
  ): PaginatedUsersResponseDto {
    const response = new PaginatedUsersResponseDto();
    response.data = UserResponseDto.fromEntities(users);
    response.pagination = pagination;
    return response;
  }
}
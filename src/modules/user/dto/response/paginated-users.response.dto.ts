import { Expose } from "class-transformer";
import { UserResponseDto } from "./user.response.dto";
import { SafeUser } from "../../../../common/types/database/entity.types";

/**
 * Pagination metadata
 */
export class PaginationMeta {
  @Expose()
  total: number;

  @Expose()
  skip: number;

  @Expose()
  take: number;

  @Expose()
  hasMore: boolean;

  @Expose()
  totalPages: number;

  @Expose()
  currentPage: number;
}

/**
 * Paginated users response DTO
 */
export class PaginatedUsersResponseDto {
  @Expose()
  data: UserResponseDto[];

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
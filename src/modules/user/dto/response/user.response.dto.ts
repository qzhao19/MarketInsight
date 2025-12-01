import { Exclude, Expose, Transform } from "class-transformer";
import { SafeUser } from "../../../../common/types/database/entity.types";

/**
 * Base response DTO with common timestamp fields
 */
abstract class BaseResponseDto {
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  createdAt: string;

  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  updatedAt: string;
}

/**
 * Standard user response DTO for client
 */
export class UserResponseDto extends BaseResponseDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  email: string;

  // password is never exposed
  @Exclude()
  password?: string;

  /**
   * Creates a UserResponseDto from a User entity
   */
  static fromEntity(user: SafeUser): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.username = user.username;
    dto.email = user.email;
    dto.createdAt = user.createdAt instanceof Date
      ? user.createdAt.toISOString()
      : String(user.createdAt);
    dto.updatedAt = user.updatedAt instanceof Date 
      ? user.updatedAt.toISOString() 
      : String(user.updatedAt);
    return dto;
  }

  /**
   * Creates an array of UserResponseDto from User entities
   */
  static fromEntities(users: SafeUser[]): UserResponseDto[] {
    return users.map(user => UserResponseDto.fromEntity(user));
  }
}
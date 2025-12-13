import { Exclude, Expose, Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { SafeUser } from "../../../../common/types/database/entity.types";

/**
 * Base response DTO with common timestamp fields
 */
abstract class BaseResponseDto {
  @ApiProperty({
    description: "Creation timestamp (ISO 8601)",
    example: "2024-01-01T00:00:00.000Z",
  })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  createdAt: string;

  @ApiProperty({
    description: "Last update timestamp (ISO 8601)",
    example: "2024-01-01T12:30:00.000Z",
  })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  updatedAt: string;
}

/**
 * Standard user response DTO for client
 */
export class UserResponseDto extends BaseResponseDto {
  @ApiProperty({
    description: "Unique user identifier (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "Username",
    example: "johndoe",
  })
  @Expose()
  username: string;

  @ApiProperty({
    description: "Email address",
    example: "john.doe@example.com",
  })
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
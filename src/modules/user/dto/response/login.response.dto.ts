import { Expose, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserResponseDto } from "./user.response.dto";
import { SafeUser } from "../../../../common/types/database/entity.types";

/**
 * Token data interface for login response
 */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
}

/**
 * Response DTO for user login
 */
export class LoginResponseDto {
  @ApiProperty({
    description: "User information",
    type: UserResponseDto,
  })
  @Expose()
  user: UserResponseDto;

  @ApiProperty({
    description: "JWT access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @Expose()
  accessToken: string;

  @ApiPropertyOptional({
    description: "JWT refresh token (optional)",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @Expose()
  refreshToken?: string;

  @ApiProperty({
    description: "Token expiration timestamp (ISO 8601)",
    example: "2024-01-01T01:00:00.000Z",
  })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  expiresAt: string;

  @ApiProperty({
    description: "Token type",
    example: "Bearer",
    default: "Bearer",
  })
  @Expose()
  tokenType: string;

  /**
   * Creates a LoginResponseDto from user and token data
   */
  static fromLogin(user: SafeUser, tokens: TokenData): LoginResponseDto {
    const response = new LoginResponseDto();
    response.user = UserResponseDto.fromEntity(user);
    response.accessToken = tokens.accessToken;
    response.refreshToken = tokens.refreshToken;
    
    const expirationDate = new Date(Date.now() + tokens.expiresIn * 1000);
    response.expiresAt = expirationDate.toISOString();
    
    response.tokenType = "Bearer";
    return response;
  }
}
import { Expose, Transform } from "class-transformer";
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
  @Expose()
  user: UserResponseDto;

  @Expose()
  accessToken: string;

  @Expose()
  refreshToken?: string;

  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  expiresAt: string;

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
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { UserService } from "./services/user.service";
import { AppConfigService } from "../../config/config.service";
import { 
  RegisterRequestDto,
  LoginRequestDto,
  UpdateUserRequestDto,
  UserResponseDto,
  LoginResponseDto,
} from "../user/dto/index"
import { AuthGuard } from "../../common/guards/api/auth.guard";
import { Public } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/user.decorator";
import { TokenPayload } from "./types/user.service-types"

/**
 * User controller - handles HTTP requests for user-related operations
 * 
 * Base path: /users
 * Full path: /api/v1/users
 * 
 * Public endpoints:
 * - POST /api/v1/users/register - Register a new user
 * - POST /api/v1/users/login - Login with credentials
 * - POST /api/v1/users/refresh - Refresh access token
 * - POST /api/v1/users/reset-password - Reset password using reset token
 * 
 * Protected endpoints (require authentication):
 * - GET /api/v1/users/me - Get current user profile
 * - POST /api/v1/users/logout - Logout (invalidate token)
 * - GET /api/v1/users/:userId - Get user by ID
 * - PUT /api/v1/users/:userId - Update user information
 * - DELETE /api/v1/users/:userId - Hard delete user account
 * - POST /api/v1/users/:userId/soft-delete - Soft delete user account
 */
@Controller("users")
@UseGuards(AuthGuard) // Apply AuthGuard globally, public routes bypass it via @Public().
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly configService: AppConfigService
  ) {
    this.logger.log(
      `UserController initialized at: ${this.configService.apiPath}/users`
    );
  }

  // ==================== Public Endpoints ====================

  /**
   * Register a new user
   * POST /api/v1/users/register
   * 
   * @Public - No authentication required
   * 
   * @example
   * Request:
   * POST /api/v1/users/register
   * {
   *   "username": "johndoe",
   *   "email": "john@example.com",
   *   "password": "SecurePass123!"
   * }
   * 
   * Response: 201 Created
   * {
   *   "success": true,
   *   "message": "User registered successfully",
   *   "data": {
   *     "id": "uuid",
   *     "username": "johndoe",
   *     "email": "john@example.com",
   *     "createdAt": "2024-01-01T00:00:00.000Z",
   *     "updatedAt": "2024-01-01T00:00:00.000Z"
   *   }
   * }
   */
  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterRequestDto): Promise<{
    success: boolean;
    message: string;
    data: UserResponseDto;
  }> {
    this.logger.log(`Registration request for username: ${dto.username}`);
    
    const user = await this.userService.register(dto);
    
    return {
      success: true,
      message: "User registered successfully",
      data: UserResponseDto.fromEntity(user),
    };
  }

  /**
   * User login
   * POST /api/v1/users/login
   * 
   * @Public - No authentication required
   * 
   * @example
   * Request:
   * POST /api/v1/users/login
   * {
   *   "emailOrUsername": "john@example.com",
   *   "password": "SecurePass123!"
   * }
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "message": "Login successful",
   *   "data": {
   *     "user": {
   *       "id": "uuid",
   *       "username": "johndoe",
   *       "email": "john@example.com",
   *       "createdAt": "2024-01-01T00:00:00.000Z",
   *       "updatedAt": "2024-01-01T00:00:00.000Z"
   *     },
   *     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
   *     "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
   *     "expiresAt": "2024-01-01T00:15:00.000Z",
   *     "tokenType": "Bearer"
   *   }
   * }
   */
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginRequestDto): Promise<{
    success: boolean;
    message: string;
    data: LoginResponseDto;
  }> {
    this.logger.log(`Login request for: ${dto.emailOrUsername}`);
    
    const loginResponse = await this.userService.login(dto);
    
    return {
      success: true,
      message: "Login successful",
      data: loginResponse,
    };
  }

  /**
   * Refresh access token
   * POST /api/v1/users/refresh
   * 
   * @Public - No authentication required
   * 
   * @example
   * Request:
   * POST /api/v1/users/refresh
   * {
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
   * }
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "message": "Token refreshed successfully",
   *   "data": {
   *     "user": { "id": "...", "username": "...", "email": "..." },
   *     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
   *     "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
   *     "expiresAt": "2024-01-01T00:15:00.000Z",
   *     "tokenType": "Bearer"
   *   }
   * }
   */
  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body("refreshToken") refreshToken: string): Promise<{
    success: boolean;
    message: string;
    data: LoginResponseDto;
  }> {
    this.logger.log("Token refresh request");
    
    if (!refreshToken || refreshToken.trim().length === 0) {
      throw new BadRequestException("Refresh token is required");
    }
    
    const loginResponse: LoginResponseDto = await this.userService.refreshToken(refreshToken);
    
    return {
      success: true,
      message: "Token refreshed successfully",
      data: loginResponse,
    };
  }

  /**
   * Reset password using reset token
   * POST /api/v1/users/reset-password
   * 
   * Note: The reset token should be sent to the user"s email first
   * 
   * @Public - No authentication required
   * 
   * @example
   * Request:
   * POST /api/v1/users/reset-password
   * {
   *   "resetToken": "eyJhbGciOiJIUzI1NiIs...",
   *   "newPassword": "NewSecurePass123!"
   * }
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "message": "Password reset successfully"
   * }
   */
  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body("resetToken") resetToken: string,
    @Body("newPassword") newPassword: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log("Password reset request");
    
    if (!resetToken || resetToken.trim().length === 0) {
      throw new BadRequestException("Reset token is required");
    }

    if (!newPassword || newPassword.trim().length === 0) {
      throw new BadRequestException("New password is required");
    }
    
    await this.userService.resetPassword(resetToken, newPassword);
    
    return {
      success: true,
      message: "Password reset successfully",
    };
  }

  // ==================== Protected Endpoints ====================

  /**
   * Get current user profile
   * GET /api/v1/users/me
   * 
   * @example
   * Request:
   * GET /api/v1/users/me
   * Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid",
   *     "username": "johndoe",
   *     "email": "john@example.com",
   *     "createdAt": "2024-01-01T00:00:00.000Z",
   *     "updatedAt": "2024-01-01T00:00:00.000Z"
   *   }
   * }
   */
  @Get("me")
  async getCurrentUser(@CurrentUser() currentUser: TokenPayload): Promise<{
    success: boolean;
    data: UserResponseDto;
  }> {
    this.logger.log(`Get current user request: ${currentUser.userId}`);
    
    const user = await this.userService.getUserById(currentUser.userId);
    
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Get user by ID
   * GET /api/v1/users/:userId
   * 
   * Note: Users can only view their own profile unless they are admins
   * 
   * @example
   * Request:
   * GET /api/v1/users/uuid-123
   * Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "id": "uuid-123",
   *     "username": "johndoe",
   *     "email": "john@example.com",
   *     "createdAt": "2024-01-01T00:00:00.000Z",
   *     "updatedAt": "2024-01-01T00:00:00.000Z"
   *   }
   * }
   */
  @Get(":userId")
  async getUserById(
    @Param("userId") userId: string,
    @CurrentUser() currentUser: TokenPayload,
  ): Promise<{
    success: boolean;
    data: UserResponseDto;
  }> {
    this.logger.log(`Get user request: ${userId} by ${currentUser.userId}`);
    
    // Users can only view their own profile (extend this for admin access)
    if (currentUser.userId !== userId) {
      throw new UnauthorizedException("You can only view your own profile");
    }
    
    const user = await this.userService.getUserById(userId);
    
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Update user information
   * PUT /api/v1/users/:userId
   * 
   * Note: Users can only update their own profile
   * 
   * @example
   * Request:
   * PUT /api/v1/users/uuid-123
   * Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   * {
   *   "username": "johndoe_updated"
   * }
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "message": "User updated successfully",
   *   "data": {
   *     "id": "uuid-123",
   *     "username": "johndoe_updated",
   *     "email": "john@example.com",
   *     "createdAt": "2024-01-01T00:00:00.000Z",
   *     "updatedAt": "2024-01-01T00:15:00.000Z"
   *   }
   * }
   */
  @Put(":userId")
  async updateUser(
    @Param("userId") userId: string,
    @Body() dto: UpdateUserRequestDto,
    @CurrentUser() currentUser: TokenPayload,
  ): Promise<{
    success: boolean;
    message: string;
    data: UserResponseDto;
  }> {
    this.logger.log(`Update user request: ${userId} by ${currentUser.userId}`);
    
    // Permission Check: users can only update their own information.
    if (currentUser.userId !== userId) {
      throw new UnauthorizedException("You can only update your own profile");
    }

    const user = await this.userService.updateUser(userId, dto);
    
    return {
      success: true,
      message: "User updated successfully",
      data: user,
    };
  }

  /**
   * Delete user account (hard delete)
   * DELETE /api/v1/users/:userId
   * 
   * Note: Users can only delete their own account
   * This performs a hard delete (permanent deletion)
   * 
   * @example
   * Request:
   * DELETE /api/v1/users/uuid-123
   * Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   * 
   * Response: 204 No Content
   */
  @Delete(":userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param("userId") userId: string,
    @CurrentUser() currentUser: TokenPayload,
  ) {
    this.logger.log(`Delete user request: ${userId} by ${currentUser.userId}`);
    
    // Permission Check: Users can only delete their own information.
    if (currentUser.userId !== userId) {
      throw new UnauthorizedException("You can only delete your own account");
    }

    await this.userService.hardDeleteUser(userId);    
  }

  /**
   * Soft delete user account
   * POST /api/v1/users/:userId/soft-delete
   * 
   * Note: Soft delete marks the user as deleted but retains data
   * User can potentially be restored later
   * 
   * @example
   * Request:
   * POST /api/v1/users/uuid-123/soft-delete
   * Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "message": "User account deactivated successfully"
   * }
   */
  @Post(":userId/soft-delete")
  @HttpCode(HttpStatus.OK)
  async softDeleteUser(
    @Param("userId") userId: string,
    @CurrentUser() currentUser: TokenPayload,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`Soft delete user request: ${userId} by ${currentUser.userId}`);
    
    // Permission Check: Users can only soft delete their own information.
    if (currentUser.userId !== userId) {
      throw new UnauthorizedException("You can only deactivate your own account");
    }
    
    await this.userService.softDeleteUser(userId);
    
    return {
      success: true,
      message: "User account deactivated successfully",
    };
  }

  /**
   * Change password (requires current password)
   * POST /api/v1/users/:userId/change-password
   */
  @Post(":userId/change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Param("userId") userId: string,
    @Body("currentPassword") currentPassword: string,
    @Body("newPassword") newPassword: string,
    @CurrentUser() currentUser: TokenPayload,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log(`Change password request for user: ${userId}`);
    
    // Permission check: users can only change their own password
    if (currentUser.userId !== userId) {
      throw new UnauthorizedException("You can only change your own password");
    }

    if (!currentPassword || currentPassword.trim().length === 0) {
      throw new BadRequestException("Current password is required");
    }

    if (!newPassword || newPassword.trim().length === 0) {
      throw new BadRequestException("New password is required");
    }
    
    await this.userService.changePassword(userId, currentPassword, newPassword);
    
    return {
      success: true,
      message: "Password changed successfully",
    };
  }
}
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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
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
import { TokenPayload } from "./types/user.types"

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
@ApiTags("Users")
@Controller("users")
@UseGuards(AuthGuard) // Apply AuthGuard globally, public routes bypass it via @Public().
@ApiBearerAuth()
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
   */
  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: "Register a new user",
    description: `Creates a new user account with username, email, and password.
    
**Validation Rules:**
- Username: 3-20 chars, starts with letter, alphanumeric + underscore only
- Email: Valid email format, max 100 chars
- Password: Min 8 chars, must contain uppercase, lowercase, digit, and special character

**Response:**
- Returns created user data (without password)
- Status 201 on success`,
  })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: "User registered successfully",
    type: UserResponseDto,
    schema: {
      example: {
        success: true,
        message: "User registered successfully",
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          username: "johndoe",
          email: "john.doe@example.com",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    },
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: "Validation error or user already exists",
    schema: {
      example: {
        statusCode: 400,
        message: ["Username must be at least 3 characters"],
        error: "Bad Request",
      },
    },
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: "Username or email already exists",
    schema: {
      example: {
        statusCode: 409,
        message: "Email already registered",
        error: "Conflict",
      },
    },
  })
  public async register(@Body() dto: RegisterRequestDto): Promise<{
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
   */
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: "User login",
    description: `Authenticates a user with email/username and password.
    
**Authentication:**
- Accepts either email or username
- Returns JWT access token and refresh token
- Access token expires in 15 minutes (configurable)
- Refresh token expires in 7 days (configurable)

**Usage:**
1. Call this endpoint with credentials
2. Store the accessToken for subsequent authenticated requests
3. Include token in Authorization header: \`Bearer <accessToken>\`
4. Use refreshToken to get new accessToken when expired`,
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Login successful",
    type: LoginResponseDto,
    schema: {
      example: {
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            username: "johndoe",
            email: "john.doe@example.com",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          expiresAt: "2024-01-01T00:15:00.000Z",
          tokenType: "Bearer",
        },
      },
    },
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: "Invalid credentials",
    schema: {
      example: {
        statusCode: 401,
        message: "Invalid email or password",
        error: "Unauthorized",
      },
    },
  })
  public async login(@Body() dto: LoginRequestDto): Promise<{
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
   */
  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: "Refresh access token",
    description: `Generates a new access token using a valid refresh token.
    
**When to Use:**
- When accessToken expires (typically after 15 minutes)
- Before making authenticated requests with an expired token

**Process:**
1. Client detects access token expiration (401 response)
2. Calls this endpoint with stored refreshToken
3. Receives new accessToken and refreshToken
4. Updates stored tokens and retries original request`,
  })
  @ApiBody({ 
    schema: { 
      type: "object",
      properties: { 
        refreshToken: { 
          type: "string", 
          description: "Valid refresh token from login",
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
        } 
      },
      required: ["refreshToken"],
    } 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Token refreshed successfully",
    type: LoginResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: "Invalid or expired refresh token",
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: "Refresh token is required",
  })
  public async refreshToken(@Body("refreshToken") refreshToken: string): Promise<{
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
   */
  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: "Reset password with reset token",
    description: `Resets user password using a password reset token.
    
**Prerequisites:**
- User must have requested a password reset (generates reset token)
- Reset token sent to user's email
- Token valid for limited time (typically 1 hour)

**Security:**
- Reset tokens are single-use
- Tokens expire after configured duration
- New password must meet strength requirements`,
  })
  @ApiBody({ 
    schema: { 
      type: "object",
      properties: { 
        resetToken: { 
          type: "string",
          description: "Password reset token from email",
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        },
        newPassword: { 
          type: "string",
          description: "New password (must meet strength requirements)",
          example: "NewSecurePass123!",
          minLength: 8,
        },
      },
      required: ["resetToken", "newPassword"],
    } 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Password reset successfully",
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: "Invalid request or weak password",
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: "Invalid or expired reset token",
  })
  public async resetPassword(
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
   */
  @Get("me")
  @ApiOperation({ 
    summary: "Get current user profile",
    description: `Retrieves the profile of the authenticated user.
    
**Usage:**
- Returns user data based on JWT token
- No userId parameter needed
- Useful for "My Profile" pages`,
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Current user profile",
    type: UserResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          username: "johndoe",
          email: "john.doe@example.com",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    },
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: "Missing or invalid authentication token",
  })
  public async getCurrentUser(@CurrentUser() currentUser: TokenPayload): Promise<{
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
   */
  @Get(":userId")
  @ApiOperation({ 
    summary: "Get user by ID (self only)",
    description: `Retrieves user information by user ID.
    
**Access Control:**
- Users can only access their own profile
- Attempting to access another user's profile returns 403`,
  })
  @ApiParam({ 
    name: "userId", 
    type: String,
    description: "User unique identifier (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "User found",
    type: UserResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Access denied - can only view own profile",
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: "User not found",
  })
  public async getUserById(
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

  
  @Put(":userId")
  @ApiOperation({ 
    summary: "Update user (self only)",
    description: `Updates user information (username and/or password).
    
**Updatable Fields:**
- username (optional)
- password (optional)

**Access Control:**
- Users can only update their own profile

**Notes:**
- All fields are optional
- Only provided fields will be updated
- Password must meet strength requirements if provided`,
  })
  @ApiParam({ 
    name: "userId", 
    type: String,
    description: "User unique identifier (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiBody({ type: UpdateUserRequestDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "User updated successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Access denied - can only update own profile",
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: "Validation error",
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: "Username already taken",
  })
  public async updateUser(
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
   */
  @Delete(":userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: "Delete user (hard delete, self only)",
    description: `Permanently deletes a user account and all associated data.
    
**Warning:** This action is irreversible!

**What Gets Deleted:**
- User account
- All campaigns created by user
- All tasks associated with campaigns
- Session tokens

**Access Control:**
- Users can only delete their own account

**Alternative:**
- Consider using POST /users/:userId/soft-delete for reversible deletion`,
  })
  @ApiParam({ 
    name: "userId", 
    type: String,
    description: "User unique identifier (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: "User deleted successfully (no content returned)",
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Access denied - can only delete own account",
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: "User not found",
  })
  public async deleteUser(
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
   */
  @Post(":userId/soft-delete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: "Soft delete user (self only)",
    description: `Deactivates a user account without permanently deleting data.
    
**Soft Delete vs Hard Delete:**
- Soft delete: Marks account as deleted, data retained
- Hard delete: Permanently removes account and all data

**Effects:**
- User cannot log in
- Account marked as deleted
- Data retained for potential recovery
- Can be restored by administrators

**Access Control:**
- Users can only soft delete their own account`,
  })
  @ApiParam({ 
    name: "userId", 
    type: String,
    description: "User unique identifier (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "User account deactivated successfully",
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Access denied - can only deactivate own account",
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: "User not found",
  })
  public async softDeleteUser(
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
  @ApiOperation({ 
    summary: "Change password (self only)",
    description: `Changes user password after verifying current password.
    
**Security:**
- Requires current password for verification
- New password must meet strength requirements
- Invalidates all existing sessions (requires re-login)

**Access Control:**
- Users can only change their own password

**Difference from Reset:**
- change-password: Requires current password (user is logged in)
- reset-password: Uses reset token (user forgot password)`,
  })
  @ApiParam({ 
    name: "userId", 
    type: String,
    description: "User unique identifier (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiBody({ 
    schema: { 
      type: "object",
      properties: { 
        currentPassword: { 
          type: "string",
          description: "Current password for verification",
          example: "OldSecurePass123!",
        },
        newPassword: { 
          type: "string",
          description: "New password (must meet strength requirements)",
          example: "NewSecurePass456!",
          minLength: 8,
        },
      },
      required: ["currentPassword", "newPassword"],
    } 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Password changed successfully",
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: "Current password is incorrect",
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Access denied - can only change own password",
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: "Invalid request or weak new password",
  })
  public async changePassword(
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
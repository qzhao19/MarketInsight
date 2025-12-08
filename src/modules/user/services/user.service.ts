import { 
  Injectable, 
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { AppConfigService } from "../../../config/config.service";
import { UserRepository } from "../repositories/user.repository";
import { 
  UserNotFoundException,
  UserAlreadyExistsException,
} from "../../../common/exceptions/database.exceptions";
import { SafeUser } from "../../../common/types/database/entity.types";
import { TokenPayload, RefreshTokenPayload } from "../types/user.types"
import {
  ListUsersRequestDto,
  LoginRequestDto,
  LoginResponseDto,
  RegisterRequestDto,
  PaginationMeta,
  PaginatedUsersResponseDto,
  UpdateUserRequestDto,
  UserResponseDto,
  TokenData,
} from "../dto/index"

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);;
  
  constructor(
    private readonly userRepository: UserRepository,
    private readonly configService: AppConfigService,
  ) {}

  // ==================== Helper Methods ====================

  /**
   * Validates password strength
   */
  private validatePasswordStrength(password: string): void { 
    const minLength = 8;
    const maxLength = 128;

    if (password.length < minLength || password.length > maxLength) {
      throw new BadRequestException(
        `Password must be between ${minLength} and ${maxLength} characters`
      );
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&#^()_+=\-[\]{}|;:"",.<>/\\`~]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasDigit || !hasSpecialChar) {
      throw new BadRequestException(
        "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character"
      );
    }
  }

  /**
   * Hashes a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> { 
    try {
      // Use salt rounds
      const saltRounds = this.configService.jwtSaltRounds;
      this.logger.debug(`Hashing password with ${saltRounds} rounds`);
      
      // Generate salt value and hash password
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      this.logger.debug("Password hashed successfully");
      return hashedPassword;
    } catch (error) {
      this.logger.error("Failed to hash password:", error);
      throw new BadRequestException("Password processing failed");
    }
  }

  /**
   * Compares a plain text password with a hashed password
   */
  private async comparePasswords(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    try {
      this.logger.debug("Comparing passwords");
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      this.logger.debug(`Password comparison result: ${isMatch}`);
      return isMatch;
    } catch (error) {
      this.logger.error("Failed to compare passwords:", error);
      throw new BadRequestException("Password verification failed");
    }
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    try {
      const jwtSecret = this.configService.jwtSecret;

      if (!jwtSecret) {
        this.logger.error("JWT secret is not configured");
        throw new Error("JWT secret is missing");
      }

      const options = {
        algorithm: this.configService.jwtAlgorithm as jwt.Algorithm,
        expiresIn: this.configService.jwtAccessTokenExpiry,
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.SignOptions;

      this.logger.debug("JWT token generated successfully");
      return jwt.sign(payload, jwtSecret, options);
    } catch (error) {
      this.logger.error("Failed to generate JWT", error);
      throw new BadRequestException("Token generation failed");
    }
  }

  private generateRefreshToken(userId: string): string { 
    try {
      const jwtSecret = this.configService.jwtSecret;
      if (!jwtSecret) {
        this.logger.error("JWT secret is not configured");
        throw new Error("JWT secret is missing");
      }

      const payload: Omit<RefreshTokenPayload, "iat" | "exp"> = {
        userId: userId,
        tokenVersion: Date.now(),
      };

      const options = {
        algorithm: this.configService.jwtAlgorithm as jwt.Algorithm,
        expiresIn: this.configService.jwtRefreshTokenExpiry,
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.SignOptions;

      this.logger.debug("JWT refresh token generated successfully");
      return jwt.sign(payload, jwtSecret, options);
    } catch (error) {
      this.logger.error("Failed to generate JWT", error);
      throw new BadRequestException("Token generation failed");
    }
  }

  /**
   * Parse JWT expiry string to seconds
   * Supports formats: "15m", "7d", "24h", or direct seconds "900"
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd]?)$/);
    
    if (!match) {
      this.logger.warn(`Invalid expiry format: ${expiry}, defaulting to 900s (15m)`);
      return 900; // Default to 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2] || "s"; // Default to seconds if no unit

    const unitMultipliers: Record<string, number> = {
      "s": 1,
      "m": 60,
      "h": 3600,
      "d": 86400,
    };

    return value * (unitMultipliers[unit] || 1);
  }

  /**
   * Generates both access and refresh tokens
   */
  private generateTokens(user: SafeUser): TokenData {
    const accessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const refreshToken = this.generateRefreshToken(user.id);
    
    const expiresIn = this.parseExpiryToSeconds(
      this.configService.jwtAccessTokenExpiry
    );

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  // ==================== Authentication ====================

  /**
   * Registers a new user
   */
  public async register(dto: RegisterRequestDto): Promise<SafeUser> {
    try {
      // Validate password strength
      this.validatePasswordStrength(dto.password);

      // Hash password
      const hashedPassword = await this.hashPassword(dto.password);

      // Create user in transaction
      const user = await this.userRepository.createUser({
        email: dto.email.toLowerCase().trim(),
        username: dto.username.trim(),
        password: hashedPassword,
      });

      this.logger.log(`New user registered: ${user.id} (${user.username})`);
      return user;
    } catch (error) {
      if (error instanceof UserAlreadyExistsException) {
        throw error;
      }
      this.logger.error(`Failed to register user: ${dto.email}`, error);
      throw new BadRequestException("Failed to register user");
    }
  }

  /**
   * Authenticates a user and returns LoginResponseDto
   */
  public async login(dto: LoginRequestDto): Promise<LoginResponseDto> { 
    try {
      // Determine if input is email or username
      const isEmail = dto.emailOrUsername.includes("@");
      const identifier = dto.emailOrUsername.trim();
      
      // Find user with password
      const user = isEmail
        ? await this.userRepository.findUserByEmailWithPassword(identifier.toLowerCase())
        : await this.userRepository.findUserByUsernameWithPassword(identifier);


      // Verify password
      const isPasswordValid = await this.comparePasswords(dto.password, user.password);

      if (!isPasswordValid) {
        this.logger.warn(`Failed login attempt for user: ${dto.emailOrUsername}`);
        throw new UnauthorizedException("Invalid credentials");
      }

      // Generate tokens
      const safeUser: SafeUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletedAt: user.deletedAt,
      };
      const tokens = this.generateTokens(safeUser);

      this.logger.log(`User logged in: ${user.id} (${user.username})`);
      return LoginResponseDto.fromLogin(safeUser, tokens);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new UnauthorizedException("Invalid credentials");
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Login failed for: ${dto.emailOrUsername}`, error);
      throw new UnauthorizedException("Login failed");
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  public async refreshToken(refreshToken: string): Promise<LoginResponseDto> { 
    try {
      // Verify refresh token
      const jwtSecret = this.configService.jwtSecret;
      const options = {
        algorithm: [this.configService.jwtAlgorithm as jwt.Algorithm],
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.VerifyOptions;

      const decoded = jwt.verify(refreshToken, jwtSecret, options) as RefreshTokenPayload;

      if (!decoded.userId) {
        throw new UnauthorizedException("Invalid refresh token payload");
      }

      // Get user from repository
      const user = await this.userRepository.findUserById(decoded.userId);

      // Generate new tokens
      const tokens = this.generateTokens(user);

      this.logger.log(`Token refreshed for user: ${user.id}`);
      return LoginResponseDto.fromLogin(user, tokens);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException("Refresh token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException("Invalid refresh token");
      }
      if (error instanceof UserNotFoundException) {
        throw new UnauthorizedException("User not found");
      }
      this.logger.error("Failed to refresh token", error);
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  /**
   * Validates a JWT token and returns the payload
   */
  public async validateToken(token: string): Promise<TokenPayload> { 
    try {
      const jwtSecret = this.configService.jwtSecret;
      const options = {
        algorithms: [this.configService.jwtAlgorithm as jwt.Algorithm],
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.VerifyOptions;
      
      const payload = jwt.verify(token, jwtSecret, options ) as TokenPayload;

      // Verify user still exists and is not deleted
      await this.userRepository.findUserById(payload.userId);

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException("Token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException("Invalid token");
      }
      if (error instanceof UserNotFoundException) {
        throw new UnauthorizedException("User not found");
      }
      throw new UnauthorizedException("Token validation failed");
    }
  }

  /**
   * Password reset
   */
  public async resetPassword(token: string, newPassword: string): Promise<SafeUser> { 
    try {
      // Validate new password strength
      this.validatePasswordStrength(newPassword);

      // Verify reset token
      const jwtSecret = this.configService.jwtSecret;
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; type: string };

      if (decoded.type !== "password-reset") {
        throw new UnauthorizedException("Invalid reset token");
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password in transaction
      const user = await this.userRepository.updateUser(decoded.userId, {
        password: hashedPassword,
      });

      this.logger.log(`Password reset for user: ${user.id}`);
      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException("Invalid or expired reset token");
      }
      if (error instanceof UserNotFoundException) {
        throw new UnauthorizedException("User not found");
      }
      this.logger.error("Password reset failed", error);
      throw new BadRequestException("Password reset failed");
    }
  }

  // ==================== User Management ====================

  /**
   * Gets a user by ID
   */
  public async getUserById(userId: string): Promise<UserResponseDto> { 
    try {
      const user = await this.userRepository.findUserById(userId);
      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get user: ${userId}`, error);
      throw new BadRequestException("Failed to retrieve user");
    }
  }

  /**
   * Gets a user by email
   */
  public async getUserByEmail(email: string): Promise<UserResponseDto> {
    try {
      const user = await this.userRepository.findUserByEmail(email.toLowerCase().trim());
      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get user by email: ${email}`, error);
      throw new BadRequestException("Failed to retrieve user");
    }
  }

  /**
   * Gets a user by username
   */
  public async getUserByUsername(username: string): Promise<UserResponseDto> {
    try {
      const user = await this.userRepository.findUserByUsername(username.trim());
      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get user by username: ${username}`, error);
      throw new BadRequestException("Failed to retrieve user");
    }
  }

  /**
   * Lists users with pagination and filtering
   */
  public async listUsers(dto: ListUsersRequestDto): Promise<PaginatedUsersResponseDto> {
    try {
      const result = await this.userRepository.findManyUsersByOptions({
        skip: dto.skip,
        take: dto.take,
        orderBy: dto.orderBy,
        where: dto.where,
      });

      const paginationMeta: PaginationMeta = {
        total: result.pagination.total,
        skip: result.pagination.skip,
        take: result.pagination.take,
        hasMore: result.pagination.hasMore,
        totalPages: result.pagination.totalPages,
        currentPage: result.pagination.currentPage,
      };

      return PaginatedUsersResponseDto.fromPaginated(result.data, paginationMeta);
    } catch (error) {
      this.logger.error("Failed to list users", error);
      throw new BadRequestException("Failed to retrieve users");
    }
  }

  /**
   * Gets total user count
   */
  public async getUserCount(): Promise<number> {
    try {
      return await this.userRepository.findUserCount();
    } catch (error) {
      this.logger.error("Failed to get user count", error);
      throw new BadRequestException("Failed to retrieve user count");
    }
  }

  /**
   * Updates a user"s profile information
   */
  public async updateUser(
    userId: string, 
    dto: UpdateUserRequestDto
  ): Promise<UserResponseDto> { 
    try {
      // If password is being updated, hash it
      const updateData: { username?: string; password?: string } = {};
      
      if (dto.username) {
        updateData.username = dto.username.trim();
      }
      
      if (dto.password) {
        this.validatePasswordStrength(dto.password);
        updateData.password = await this.hashPassword(dto.password);
      }

      // Update user in transaction
      const updatedUser = await this.userRepository.updateUser(userId, updateData);

      this.logger.log(`User updated: ${userId}`);
      return UserResponseDto.fromEntity(updatedUser);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      if (error instanceof UserAlreadyExistsException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update user: ${userId}`, error);
      throw new BadRequestException("Failed to update user");
    }
  }

  /**
   * Hard deletes a user (permanently removes)
   */
  public async hardDeleteUser(userId: string): Promise<void> { 
    try {
      await this.userRepository.hardDeleteUser(userId);
      this.logger.log(`User permanently deleted: ${userId}`);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete user: ${userId}`, error);
      throw new BadRequestException("Failed to delete user");
    }
  }

  /**
   * Soft deletes a user (marks as deleted)
   */
  public async softDeleteUser(userId: string): Promise<void> { 
    try {
      await this.userRepository.softDeleteUser(userId);
      this.logger.log(`User soft deleted: ${userId}`);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to soft delete user: ${userId}`, error);
      throw new BadRequestException("Failed to delete user");
    }
  }

  /**
   * Changes user password (requires current password verification)
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Validate new password strength
      this.validatePasswordStrength(newPassword);

      // Get user with password
      const user = await this.userRepository.findUserByIdWithPassword(userId);

      // Verify current password
      const isCurrentPasswordValid = await this.comparePasswords(
        currentPassword,
        user.password
      );

      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException("Current password is incorrect");
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await this.userRepository.updateUser(userId, {
        password: hashedPassword,
      });

      this.logger.log(`Password changed for user: ${userId}`);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Failed to change password for user: ${userId}`, error);
      throw new BadRequestException("Failed to change password");
    }
  }
}
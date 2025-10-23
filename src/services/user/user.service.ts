import { 
  Injectable, 
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { DatabaseService } from "../../database/database.service";
import { AppConfigService } from "../../config/config.service";
import { RegisterDto } from "../../api/user/dto/register.dto";
import { LoginDto } from "../../api/user/dto/login.dto";
import { UpdateUserDto } from "../../api/user/dto/update.dto";
import { 
  ClientUserResponseDto, 
  LoginResponseDto, 
  UserStatsResponseDto,
  UserStatsData,
} from "../../api/user/dto/response.dto";
import { SafeUser } from "../../types/database/entities.types";
import { 
  UserNotFoundException,
  UserAlreadyExistsException,
} from "../../common/exceptions/database.exceptions";
import { TokenPayload, RefreshTokenPayload } from "../../types/service/user.types"
import { TokenData } from "../../types/api/dto.types"

@Injectable()
export class UserService {
  private readonly logger;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: AppConfigService,
  ) {
    this.logger = new Logger(UserService.name);
  }

   // ==================== Helper Methods ====================
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
    const hasSpecialChar = /[@$!%*?&#^()_+=\-[\]{}|;:'",.<>/\\`~]/.test(password);

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
      return await bcrypt.hash(password, this.configService.jwtSaltRounds);
    } catch (error) {
      this.logger.error("Failed to hash password", error);
      throw new BadRequestException("Password processing failed");
    }
  }

  /**
   * Compares a plain text password with a hashed password
   */
  private async comparePasswords(
    password: string, hash: string
  ): Promise<boolean> { 
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      this.logger.error("Failed to compare passwords", error);
      return false;
    }
  }

  /**
   * Generate JWT Access Token
   */
  private generateJWT(payload: any): string {
    try {
      const jwtSecret = this.configService.jwtSecret;

      const options = {
        algorithm: this.configService.jwtAlgorithm,
        expiresIn: this.configService.jwtAccessTokenExpiry,
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.SignOptions;

      return jwt.sign(payload, jwtSecret, options);

    } catch (error) {
      this.logger.error("Failed to generate JWT", error);
      throw new BadRequestException("Token generation failed");
    }
  }

  private generateRefreshToken(userId: string): string { 
    try {
      const jwtSecret = this.configService.jwtSecret;
      const payload: Omit<RefreshTokenPayload, "iat" | "exp"> = {
        userId: userId,
        tokenVersion: Date.now(),
      };

      const options = {
        algorithm: this.configService.jwtAlgorithm,
        expiresIn: this.configService.jwtRefreshTokenExpiry,
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.SignOptions;

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
    const unit = match[2] || 's'; // Default to seconds if no unit

    const unitMultipliers: Record<string, number> = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
    };

    return value * (unitMultipliers[unit] || 1);
  }

  // ==================== Authentication ====================

  /**
   * Registers a new user
   */
  public async register(dto: RegisterDto): Promise<SafeUser> {
    try {
      // Validate password strength
      this.validatePasswordStrength(dto.password);

      // Hash password
      const hashedPassword = await this.hashPassword(dto.password);

      // Create user in transaction
      const user = await this.databaseService.transaction(async (tx) => {
        return tx.user.createUser({
          email: dto.email.toLowerCase().trim(),
          username: dto.username.trim(),
          password: hashedPassword,
        });
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
  public async login(dto: LoginDto): Promise<LoginResponseDto> { 
    try {
      // Determine if input is email or username
      const isEmail = dto.emailOrUsername.includes("@");

      // Find user with password
      let user;
      if (isEmail) {
        user = await this.databaseService.user.findUserByEmailWithPassword(
          dto.emailOrUsername.toLowerCase().trim()
        );
      } else {
        user = await this.databaseService.user.findUserByUsernameWithPassword(
          dto.emailOrUsername.trim()
        );
      }

      // Verify password
      const isPasswordValid = await this.comparePasswords(
        dto.password,
        user.password
      );


      if (!isPasswordValid) {
        this.logger.warn(`Failed login attempt for user: ${dto.emailOrUsername}`);
        throw new UnauthorizedException("Invalid credentials");
      }

      // Generate tokens
      const accessToken = this.generateJWT({
        userId: user.id,
        email: user.email,
        username: user.username,
      });

      const refreshToken = this.generateRefreshToken(user.id);

      // Convert to SafeUser (exclude password)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = user;
      
      // Deafault minutes in seconds
      const expiresIn = this.parseExpiryToSeconds(
        this.configService.jwtAccessTokenExpiry
      );

      const tokens: TokenData = {
        accessToken,
        refreshToken,
        expiresIn,
      };

      this.logger.log(`User logged in: ${user.id} (${user.username})`);
      return LoginResponseDto.fromLogin(safeUser as SafeUser, tokens);

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
        algorithm: [this.configService.jwtAlgorithm],
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.VerifyOptions;

      const decoded = jwt.verify(refreshToken, jwtSecret, options) as RefreshTokenPayload;

      if (!decoded.userId) {
        throw new UnauthorizedException("Invalid refresh token payload");
      }

      // Get user
      const user = await this.databaseService.user.findUserById(decoded.userId);

      // Generate new tokens
      const newAccessToken = this.generateJWT({
        userId: user.id,
        email: user.email,
        username: user.username,
      });

      const newRefreshToken = this.generateRefreshToken(user.id);
      const expiresIn = this.parseExpiryToSeconds(
        this.configService.jwtAccessTokenExpiry
      );

      const tokens: TokenData = {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      };

      this.logger.log(`Token refreshed for user: ${user.id}`);
      return LoginResponseDto.fromLogin(user, tokens);
    } catch (error) {
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
        algorithms: [this.configService.jwtAlgorithm],
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
      } as jwt.VerifyOptions;
      
      const payload = jwt.verify(token, jwtSecret, options ) as TokenPayload;

      // Verify user still exists and is not deleted
      await this.databaseService.user.findUserById(payload.userId);

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException("Token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException("Invalid token");
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
      const user = await this.databaseService.transaction(async (tx) => {
        return tx.user.updateUser(decoded.userId, {
          password: hashedPassword,
        });
      });

      this.logger.log(`Password reset for user: ${user.id}`);
      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException("Invalid or expired reset token");
      }
      this.logger.error("Password reset failed", error);
      throw new BadRequestException("Password reset failed");
    }
  }

  // ==================== User Management ====================
  public async getUserById(userId: string): Promise<ClientUserResponseDto> { 
    try {
      const user = await this.databaseService.user.findUserById(userId);
      return ClientUserResponseDto.fromEntity(user);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get user: ${userId}`, error);
      throw new BadRequestException("Failed to retrieve user");
    }
  }

  /**
   * Updates a user's profile information
   */
  public async updateUser(
    userId: string, 
    dto: UpdateUserDto
  ): Promise<ClientUserResponseDto> { 
    try {
      // If password is being updated, hash it
      const updateData: any = {};
      
      if (dto.username) {
        updateData.username = dto.username.trim();
      }
      
      if (dto.password) {
        this.validatePasswordStrength(dto.password);
        updateData.password = await this.hashPassword(dto.password);
      }

      // Update user in transaction
      const updatedUser = await this.databaseService.transaction(async (tx) => {
        return tx.user.updateUser(userId, updateData);
      });

      this.logger.log(`User updated: ${userId}`);
      return ClientUserResponseDto.fromEntity(updatedUser);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      if (error instanceof UserAlreadyExistsException) {
        throw new ConflictException(error.message);
      }
      this.logger.error(`Failed to update user: ${userId}`, error);
      throw new BadRequestException("Failed to update user");
    }
  }

  public async deleteUser(userId: string): Promise<void> { 
    try {
      await this.databaseService.transaction(async (tx) => {
        // Hard delete user (cascades to campaigns and tasks based on Prisma schema)
        await tx.user.hardDeleteUser(userId);
      });

      this.logger.log(`User permanently deleted: ${userId}`);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete user: ${userId}`, error);
      throw new BadRequestException("Failed to delete user");
    }
  }

  public async softDeleteUser(userId: string): Promise<void> { 
    try {
      await this.databaseService.transaction(async (tx) => {
        await tx.user.softDeleteUser(userId);
      });

      this.logger.log(`User soft deleted: ${userId}`);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to soft delete user: ${userId}`, error);
      throw new BadRequestException("Failed to delete user");
    }
  }

}
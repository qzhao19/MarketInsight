import { Injectable, Logger } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { ClientConfigService } from "./llm/client.config";
import { ModelConfigService } from "./llm/model.config";

/**
 * Application configuration service
 * Provides centralized access to all configuration services
 * Acts as a facade for client and model configurations
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    private readonly nestConfigService: NestConfigService,
    private readonly clientConfig: ClientConfigService,
    private readonly modelConfig: ModelConfigService,
  ) {
    this.logger.log("AppConfigService initialized");
  }

  // ==================== Client Configuration Access ====================

  /**
   * Get client configuration service
   * Provides access to circuit breaker, rate limiter, request queue, and retry configs
   */
  get LLMClientConfig(): ClientConfigService {
    return this.clientConfig;
  }

  // ==================== Model Configuration Access ====================

  /**
   * Get model configuration service
   * Provides access to LLM model parameters and settings
   */
  get LLMModelConfig(): ModelConfigService {
    return this.modelConfig;
  }

  // ==================== Environment Variables Access ====================

  /**
   * Get environment variable value
   * @param key - Environment variable key
   * @param defaultValue - Default value if not found
   */
  get<T = any>(key: string, defaultValue?: T): T | undefined {
    if (defaultValue === undefined) {
      return this.nestConfigService.get<T>(key);
    }
    return this.nestConfigService.get<T>(key, defaultValue);
  }

  /**
   * Get environment variable as string
   */
  getString(key: string, defaultValue: string): string {
    const value = this.nestConfigService.get<string>(key, defaultValue);

    if (!value || value.trim().length === 0) {
      this.logger.warn(
        `Empty or invalid string for ${key}. Using default: ${defaultValue}`
      );
      return defaultValue;
    }
    return value.trim(); 
  }

  /**
   * Get environment variable as number
   */
  getNumber(key: string, defaultValue: number): number {
    const value = this.nestConfigService.get<string>(key);
    
    if (value === undefined || value === null || value === '') {
      this.logger.debug(`Using default value for ${key}: ${defaultValue}`);
      return defaultValue;
    }

    const parsed = parseInt(value, 10);
    
    if (isNaN(parsed)) {
      this.logger.warn(
        `Invalid number for ${key}: "${value}". Using default: ${defaultValue}`
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Get environment variable as boolean
   */
  getBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.nestConfigService.get<string>(key);
    
    if (value === undefined || value === null) {
      return defaultValue;
    }

    const lowerValue = String(value).toLowerCase().trim();
    return lowerValue === "true" || lowerValue === "1";
  }

  // ==================== Application-Level Configuration ====================

  /**
   * Get application port
   */
  get appPort(): number {
    return this.getNumber("PORT", 3000);
  }

  /**
   * Get application environment
   */
  get appEnvironment(): string {
    return this.getString("NODE_ENV", "development");
  }

  /**
   * Check if running in production
   */
  get isProduction(): boolean {
    return this.appEnvironment === "production";
  }

  /**
   * Check if running in development
   */
  get isDevelopment(): boolean {
    return this.appEnvironment === "development";
  }

  /**
   * Check if running in test
   */
  get isTest(): boolean {
    return this.appEnvironment === "test";
  }

  /**
   * Get application name
   */
  get appName(): string {
    return this.getString("APP_NAME", "MarketInsight");
  }

  /**
   * Get application version
   */
  get appVersion(): string {
    return this.getString("APP_VERSION", "1.0.0");
  }

  // ==================== JWT Configuration ====================

  /**
   * Get JWT secret key for signing and verifying tokens
   */
  get jwtSecret(): string {
    return  this.getString("JWT_SECRET", "");
  }

   /**
   * Get JWT access token expiration time
   */
  get jwtAccessTokenExpiry(): string {
    return this.getString("JWT_ACCESS_TOKEN_EXPIRY", "15m");
  }

  /**
   * Get JWT refresh token expiration time
   */
  get jwtRefreshTokenExpiry(): string {
    return this.getString("JWT_REFRESH_TOKEN_EXPIRY", "7d");
  }

  /**
   * Get JWT algorithm used for signing
   * default HS256 (HMAC with SHA-256)
   */
  get jwtAlgorithm(): string {
    return this.getString("JWT_ALGORITHM", "HS256");
  }

  /**
   * Get JWT SaltOrRounds parameter
   */
  get jwtSaltRounds(): number {
    return this.getNumber("JWT_SALT_ROUNDS", 10);
  }

  /**
   * Get JWT issuer parameter
   */
  get jwtIssuer(): string {
    return this.getString("JWT_ISSUER", "marketinsight");
  }

  /**
   * Get JWT audience parameter
   */
  get jwtAudience(): string {
    return this.getString("JWT_AUDIENCE", "marketinsight-user");
  }


  // ==================== LLM API Configuration ====================

  /**
   * Get LLM API key
   */
  get llmApiKey(): string {
    return this.getString("LLM_API_KEY", "");
  }

  /**
   * Get LLM API base url
   */
  get llmBaseURL(): string {
    return this.getString("LLM_BASE_URL", "");
  }

  // ==================== LLM API Configuration ====================

  /**
   * Get SERPER API key
   */
  get serperApiKey(): string {
    return this.getString("SERPER_API_KEY", "");
  }

  // ==================== API Configuration ====================

  /**
   * Get API prefix
   */
  get apiPrefix(): string {
    return this.getString("API_PREFIX", "api");
  }

  /**
   * Get API version
   */
  get apiVersion(): string {
    return this.getString("API_VERSION", "v1");
  }

  /**
   * Get full API path
   */
  get apiPath(): string {
    return `/${this.apiPrefix}/${this.apiVersion}`;
  }

  // ==================== Database Configuration ====================

  /**
   * Get database host
   */
  get dbHost(): string {
    return this.getString("DB_HOST", "localhost");
  }

  /**
   * Get database port
   */
  get dbPort(): number {
    return this.getNumber("DB_PORT", 5432);
  }

  /**
   * Get database name
   */
  get dbName(): string {
    return this.getString("DB_NAME", "marketinsight");
  }

  /**
   * Get database username
   */
  get dbUsername(): string {
    return this.getString("DB_USERNAME", "postgres");
  }

  /**
   * Get database password
   */
  get dbPassword(): string {
    return this.getString("DB_PASSWORD", "");
  }

  // ==================== CORS Configuration ====================

  /**
   * Get CORS origins
   */
  get corsOrigins(): string[] {
    const origins = this.getString("CORS_ORIGINS", "*");
    return origins.split(",").map(origin => origin.trim());
  }

  /**
   * Check if CORS is enabled
   */
  get corsEnabled(): boolean {
    return this.getBoolean("CORS_ENABLED", true);
  }

  // ==================== Rate Limiting Configuration ====================

  /**
   * Get global rate limit window (ms)
   */
  get rateLimitWindow(): number {
    return this.getNumber("RATE_LIMIT_WINDOW", 60000);
  }

  /**
   * Get global rate limit max requests
   */
  get rateLimitMax(): number {
    return this.getNumber("RATE_LIMIT_MAX", 100);
  }
}
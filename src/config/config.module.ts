import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';
import { ClientConfigService } from './llm/client.config';
import { ModelConfigService } from './llm/model.config';
import * as path from 'path';

/**
 * Global configuration module
 * Provides centralized access to all application configurations
 * 
 * This module:
 * 1. Loads environment variables from .env, .env.service, and .env.model files
 * 2. Provides AppConfigService as a facade for all config services
 * 3. Exports ClientConfigService and ModelConfigService for direct access
 * 4. Is marked as @Global() so it's available throughout the application
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        // Load in order: specific to general
        // Later files override earlier ones
        path.resolve(process.cwd(), '.env.base'),   // Base configuration
        path.resolve(process.cwd(), '.env.llm'),    // LLM-Model-specific config
        
      ],
      // ignoreEnvFile: process.env.NODE_ENV === 'production', // Don't load .env in production
      cache: true, // Cache env variables for better performance
      expandVariables: true, // Support variable expansion like ${VAR}
    }),
  ],
  providers: [
    // LLM Configuration Services
    ClientConfigService,
    ModelConfigService,
    // Main Application Config Service (Facade)
    AppConfigService,
  ],
  exports: [
    ClientConfigService,
    ModelConfigService,
    // Export main config service (recommended usage)
    AppConfigService,
  ],
})
export class AppConfigModule {}
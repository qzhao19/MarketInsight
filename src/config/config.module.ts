import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { AppConfigService } from "./config.service";
import { AgentConfigService } from './agent/agent.config';
import { ClientConfigService } from "./llm/client.config";
import { ModelConfigService } from "./llm/model.config";
import * as path from "path";

/**
 * Global configuration module
 * Provides centralized access to all application configurations
 * 
 * This module:
 * 1. Loads environment variables from .env.base, .env.service, and .env.model files etc
 * 2. Provides AppConfigService as a facade for all config services
 * 3. Exports ClientConfigService and ModelConfigService for direct access
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        // Load in order: specific to general
        // Later files override earlier ones
        path.resolve(process.cwd(), "env/.env.secrets"),
        path.resolve(process.cwd(), "env/.env.base"),   // Base configuration
        path.resolve(process.cwd(), "env/.env.llm"),    // LLM-Model-specific config
        path.resolve(process.cwd(), "env/.env.db"),    // LLM-Model-specific config
      ],
      // ignoreEnvFile: process.env.NODE_ENV === "production", // Don"t load .env in production
      cache: true, // Cache env variables for better performance
      expandVariables: true, // Support variable expansion like ${VAR}
    }),
  ],
  providers: [
    // Agent Configuration Service
    AgentConfigService,
    // LLM Configuration Services
    ClientConfigService,
    ModelConfigService,
    // Main Application Config Service
    AppConfigService,
  ],
  exports: [
    AppConfigService,
  ],
})
export class AppConfigModule {}
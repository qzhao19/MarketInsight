import { Module, forwardRef } from "@nestjs/common";
import { ModelService } from "./model.service";
import { ModelClientModule } from "./client/client.module";
import { AppConfigModule } from "../../config/config.module";

/**
 * Module for managing LLM models
 * 
 * This module:
 * 1. Imports AppConfigModule to access configuration services
 * 2. Provides ModelService for creating and managing LLM models
 * 3. Imports ModelClientModule for client protection mechanisms
 */
@Module({
  imports: [
    AppConfigModule,
    forwardRef(() => ModelClientModule)
  ],
  controllers: [],
  providers: [ModelService],
  exports: [ModelService],
})
export class ModelModule {}
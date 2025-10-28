import { Module, forwardRef } from "@nestjs/common";
import { LLModelService } from "./model.service";
import { LLModelClientModule } from "./client/client.module";
import { AppConfigModule } from "../config/config.module";

/**
 * Module for managing LLM models
 * 
 * This module:
 * 1. Imports AppConfigModule to access configuration services
 * 2. Provides LLModelService for creating and managing LLM models
 * 3. Imports LLModelClientModule for client protection mechanisms
 */
@Module({
  imports: [
    AppConfigModule,
    forwardRef(() => LLModelClientModule)
  ],
  controllers: [],
  providers: [LLModelService],
  exports: [LLModelService],
})
export class LLModelModule {}
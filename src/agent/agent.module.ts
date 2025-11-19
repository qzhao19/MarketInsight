import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AppConfigModule } from '../config/config.module';
import { LLModelService } from "../llm/model.service";


@Module({
  imports: [
    AppConfigModule,
    LLModelService,
  ],
  providers: [
    AgentService
  ],
  exports: [
    AgentService,
  ],
})
export class AgentModule {}
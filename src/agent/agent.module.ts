import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AppConfigModule } from '../config/config.module';
import { LLModelModule } from "../llm/model.module";


@Module({
  imports: [
    AppConfigModule,
    LLModelModule,
  ],
  providers: [
    AgentService
  ],
  exports: [
    AgentService,
  ],
})
export class AgentModule {}
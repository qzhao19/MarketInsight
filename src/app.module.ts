import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/config.module"; 
import { AgentModule } from "./agent/agent.module";
import { ApiModule } from "./api/api.module";
import { LLModelModule } from "./llm/model.module";

@Module({
  imports: [
    AppConfigModule,
    AgentModule,
    ApiModule,
    LLModelModule,
  ],
  controllers: [], 
  providers: [],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/config.module"; 
import { AgentModule } from "./llm/agents/agent.module";

@Module({
  imports: [
    AppConfigModule,
    AgentModule,
  ],
  controllers: [], 
  providers: [],
})
export class AppModule {}

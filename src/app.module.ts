import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ModelModule } from "./llm/model/model.module";
import { AgentModule } from "./llm/agents/agent.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      cache: true,
      expandVariables: true,
    }),
    ModelModule,
    AgentModule,
  ],
  controllers: [], 
  providers: [],
})
export class AppModule {}
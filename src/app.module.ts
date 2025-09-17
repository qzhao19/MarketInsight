import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ModelModule } from "./llm/model/model.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      cache: true,
      expandVariables: true,
    }),
    ModelModule,
  ],
  controllers: [], 
  providers: [],
})
export class AppModule {}
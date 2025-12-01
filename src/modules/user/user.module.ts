import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./services/user.service";
import { UserRepository } from "./repositories/user.repository";
import { PrismaModule } from "../../core/database/prisma.module";
import { AppConfigModule } from "../../config/config.module";

@Module({
  imports: [
    PrismaModule,
    AppConfigModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserRepository,
  ],
  exports: [
    UserService,
  ],
})
export class UserModule {}
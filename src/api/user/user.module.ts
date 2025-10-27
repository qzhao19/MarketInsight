import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserModule } from '../../services/user/user.module';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [
    UserModule,
    AppConfigModule,
  ],
  controllers: [UserController],
})
export class UserApiModule {}
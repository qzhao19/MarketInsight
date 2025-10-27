import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { DatabaseModule } from '../../database/database.module';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [
    DatabaseModule, 
    AppConfigModule
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
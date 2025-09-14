import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModelService } from './model.service';
import { ModelClientModule } from './client/client.module'

@Module({
  imports: [ConfigModule, ModelClientModule],
  providers: [
    ModelService,    
  ],
  exports: [ModelService],
})
export class ModelModule {}
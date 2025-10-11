import { Module } from '@nestjs/common';
import { MarketResearchService } from './market_research.service';
import { ModelModule } from '../../model/model.module';
import { AppConfigModule } from '../../../config/config.module';

@Module({
  imports: [
    ModelModule,
    AppConfigModule,
  ],
  providers: [
    MarketResearchService,
  ],
  exports: [
    MarketResearchService,
  ],
})
export class MarketResearchModule {}
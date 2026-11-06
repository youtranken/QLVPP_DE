import { Module } from '@nestjs/common';
import { PeriodsModule } from '../periods/periods.module';
import { FileAccessPolicy } from './file-access.policy';
import { FilesCleanupJob } from './files-cleanup.job';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PeriodsModule],
  controllers: [FilesController],
  providers: [FilesService, FileAccessPolicy, FilesCleanupJob],
  exports: [FilesService, FileAccessPolicy],
})
export class FilesModule {}

import { Module } from '@nestjs/common';
import { FileAccessPolicy } from './file-access.policy';
import { FilesCleanupJob } from './files-cleanup.job';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, FileAccessPolicy, FilesCleanupJob],
  exports: [FilesService, FileAccessPolicy],
})
export class FilesModule {}

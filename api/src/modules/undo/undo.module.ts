import { Module } from '@nestjs/common';
import { UndoLedgerService } from './undo-ledger.service';

@Module({
  providers: [UndoLedgerService],
  exports: [UndoLedgerService],
})
export class UndoModule {}

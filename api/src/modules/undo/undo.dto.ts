import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export const UNDO_MAX_IDS = 100;

export class UndoBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(UNDO_MAX_IDS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids!: string[];
}

export interface UndoResult {
  undone: number;
}

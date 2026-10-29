import { IsInt, Max, Min } from 'class-validator';

export const DELIVER_QTY_MAX = 9999;

export class DeliverBody {
  @IsInt() @Min(1) @Max(DELIVER_QTY_MAX) qty!: number;
  @IsInt() @Min(0) expected_delivered_qty!: number;
}

export interface DeliverResult {
  line: {
    id: string;
    qty: number;
    delivered_qty: number;
    cancelled_qty: number;
  };
  movement_id: string | null;
  stock_qty: number | null;
  request_complete: boolean;
}

export interface DeliverAllFailure {
  line_id: string;
  code: string;
  available?: number;
}

export interface DeliverAllResult {
  delivered: { line_id: string; qty: number }[];
  failed: DeliverAllFailure[];
}

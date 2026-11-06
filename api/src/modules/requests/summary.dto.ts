import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQuery } from '../../common/page.query';

export const SUMMARY_FILTERS = [
  'all',
  'pending_delivery',
  'custom_pending',
  'over_max',
  'left',
] as const;
export type SummaryFilter = (typeof SUMMARY_FILTERS)[number];

export class PeriodRequestsQuery extends PageQuery {
  @IsOptional() @IsIn(['person', 'item']) by: 'person' | 'item' = 'person';

  @IsOptional() @IsIn(SUMMARY_FILTERS) filter: SummaryFilter = 'all';

  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

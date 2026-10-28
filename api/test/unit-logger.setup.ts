import { Logger } from '@nestjs/common';

// Spec unit cố ý đi nhánh lỗi (PMH ID sập, rollback…) — log Nest làm bẩn output DoD
Logger.overrideLogger(false);

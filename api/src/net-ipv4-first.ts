// PMH ID allow-list theo IPv4 nguồn; DNS mặc định 'verbatim' có thể đi IPv6 → bị chặn. Import dòng đầu main.ts.
import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

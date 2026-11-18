export type Greeting = 'morning' | 'afternoon' | 'evening';

const HOUR_VN = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' });

export function greetingKey(now: Date): Greeting {
  const h = Number(HOUR_VN.format(now));
  return h < 11 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

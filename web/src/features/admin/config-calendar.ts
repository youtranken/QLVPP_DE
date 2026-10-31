export type DayKind = 'open' | 'deadline' | 'locked';

export interface PreviewDay {
  day: number;
  kind: DayKind;
  reminder: boolean;
}

export interface PreviewMonth {
  leadingBlanks: number;
  days: PreviewDay[];
}

// Cùng luật isReminderDay của api: nhắc khi số ngày còn lại (tính cả hôm nay) bằng reminder → ngày lastDay − reminder + 1
export function previewMonth(ym: string, lastDay: number, reminder: number | null): PreviewMonth {
  const [y, m] = ym.split('-').map(Number);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leadingBlanks = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const remindOn = reminder !== null && reminder >= 1 && reminder <= 7 && reminder < lastDay ? lastDay - reminder + 1 : null;
  const days = Array.from({ length }, (_, i): PreviewDay => {
    const day = i + 1;
    const kind: DayKind = day < lastDay ? 'open' : day === lastDay ? 'deadline' : 'locked';
    return { day, kind, reminder: day === remindOn };
  });
  return { leadingBlanks, days };
}

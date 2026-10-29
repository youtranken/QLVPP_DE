import { useRef, useState } from 'react';

// State chỉ đổi ở lần vẽ sau: hai cú bấm sát nhau vẫn thấy pending = false, nên chặn bằng ref
export function useSingleFlight() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await task();
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return { pending, run };
}

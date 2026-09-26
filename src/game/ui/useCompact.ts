import { useEffect, useState } from 'react';
import { COMPACT_QUERY } from './lanes';

/** True on a narrow screen, where the aside and the focus lane share one bottom stack (lanes.ts). */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => typeof matchMedia === 'function' && matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(COMPACT_QUERY);
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

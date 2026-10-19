import { useEffect, useState } from 'react';

/**
 * Browser connectivity status.
 *
 * NOTE: `navigator.onLine` only reflects the device's own network state —
 * it does not prove any remote server is reachable. KiranaIQ has no
 * required remote calls, so this indicator is informational only.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

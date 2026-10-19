import { Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Online/offline chip. Informational only — KiranaIQ works offline; this
 * reflects the device's network state (not server reachability).
 */
export function ConnectionChip() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  return (
    <span
      className={`badge ${online ? 'badge--ok' : 'badge--neutral'}`}
      title={online ? t('offline.allGood') : t('offline.savedOnDevice')}
      aria-label={`${t('offline.status')}: ${online ? t('offline.online') : t('offline.offline')}`}
      role="status"
    >
      {online ? <Wifi size={13} aria-hidden="true" /> : <WifiOff size={13} aria-hidden="true" />}
      {online ? t('offline.online') : t('offline.offline')}
    </span>
  );
}

/** Full-width banner shown while offline (reminds data still saves locally). */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="alert alert--info mb-4" role="status">
      <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{t('dashboard.offlineBanner')}</span>
    </div>
  );
}

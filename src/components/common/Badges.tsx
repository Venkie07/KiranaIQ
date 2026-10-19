import type { ReactNode } from 'react';
import { PackageCheck, PackageX, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExpiryRisk, StockStatus } from '@/domain/types';

/** Stock status badge: color + icon + text (never color alone). */
export function StockBadge({ status }: { status: StockStatus }) {
  const { t } = useTranslation();
  const map = {
    ok: { cls: 'badge--ok', label: t('products.stockStatusOk'), Icon: PackageCheck },
    low: { cls: 'badge--low', label: t('products.stockStatusLow'), Icon: TriangleAlert },
    out: { cls: 'badge--out', label: t('products.stockStatusOut'), Icon: PackageX },
  } as const;
  const { cls, label, Icon } = map[status];
  return (
    <span className={`badge ${cls}`}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ExpiryBadge({ risk }: { risk: ExpiryRisk }) {
  const { t } = useTranslation();
  const map = {
    expired: { cls: 'badge--danger', label: t('expiry.expired') },
    critical: { cls: 'badge--danger', label: t('expiry.riskCritical') },
    warning: { cls: 'badge--low', label: t('expiry.riskWarning') },
    upcoming: { cls: 'badge--neutral', label: t('expiry.upcoming') },
  } as const;
  const { cls, label } = map[risk];
  return <span className={`badge ${cls}`}>{label}</span>;
}

/** Small "Demo" provenance badge for seeded records. */
export function DemoBadge() {
  const { t } = useTranslation();
  return (
    <span className="badge badge--demo" title={t('settings.clearDemoHint')}>
      {t('common.demoBadge')}
    </span>
  );
}

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, icon, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__title">
        {icon}
        <h1>{title}</h1>
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

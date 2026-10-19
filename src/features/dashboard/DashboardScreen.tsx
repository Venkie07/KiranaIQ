import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  Gauge,
  PackagePlus,
  Plus,
  RefreshCcw,
  ShoppingCart,
  Turtle,
} from 'lucide-react';
import { PageHeader, DemoBadge } from '@/components/common/Badges';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { LoadingState, ErrorState } from '@/components/feedback/States';
import { OfflineBanner } from '@/components/feedback/ConnectionStatus';
import { SubNav } from '@/components/layout/AppLayout';
import { useSettings } from '@/hooks/useSettings';
import { getServices } from '@/services/serviceFactory';
import { formatLongDate, todayISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { ExpiryAlert, LowStockAlert, Sale, SlowMovingProduct } from '@/domain/types';

interface DashboardData {
  productCount: number;
  inventoryValue: number | null;
  lowStock: LowStockAlert[];
  expiry: ExpiryAlert[];
  slowMoving: SlowMovingProduct[];
  recentSales: Sale[];
  demoDataPresent: boolean;
}

function greetingKeyForHour(hour: number): string {
  if (hour < 12) return 'dashboard.greetingMorning';
  if (hour < 17) return 'dashboard.greetingAfternoon';
  return 'dashboard.greetingEvening';
}

export function DashboardScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [data, setData] = useState<DashboardData | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = () => {
    setErrorKey(null);
    setData(null);
    void (async () => {
      try {
        const services = getServices();
        const [views, lowStock, expiry, slowMoving, recentSales] = await Promise.all([
          services.products.list(),
          services.alerts.lowStock(),
          services.alerts.expiry(settings.expiryWarningDays),
          services.alerts.slowMoving(settings.slowMovingDays),
          services.sales.list(5),
        ]);
        // Estimated value: usable stock × cost (paise). Null when no cost data.
        let valueSum = 0;
        let valueKnown = false;
        for (const row of views) {
          const cost = row.variant.costPrice;
          if (cost != null && cost > 0) {
            valueSum += cost * row.usableStock;
            valueKnown = true;
          }
        }
        const productCount = new Set(views.map((v) => v.product.id)).size;
        const demoDataPresent = views.some((v) => v.product.demo);
        setData({
          productCount,
          inventoryValue: valueKnown ? valueSum : null,
          lowStock,
          expiry,
          slowMoving,
          recentSales,
          demoDataPresent,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[dashboard] load failed', err);
        setErrorKey('errors.dbInit');
      }
    })();
  };

  useEffect(load, [settings.expiryWarningDays, settings.slowMovingDays]);

  if (errorKey) return <ErrorState errorKey={errorKey} onRetry={load} />;
  if (!data) return <LoadingState />;

  const hour = new Date().getHours();
  const greetingKey = greetingKeyForHour(hour);
  const slowOnly = data.slowMoving.filter((s) => s.reason === 'no-recent-sales');

  // Attention list: out-of-stock first, then expiring today/overdue, then low.
  const attention: { key: string; text: string; to: string; tone: string }[] = [];
  for (const item of data.lowStock.slice(0, 3)) {
    attention.push({
      key: `low-${item.variantId}`,
      text: `${item.productName} · ${t('dashboard.lowStockItem', { count: item.currentStock })}`,
      to: `/products/${item.productId}`,
      tone: item.status === 'out' ? 'danger' : 'warning',
    });
  }
  for (const item of data.expiry.slice(0, 3)) {
    attention.push({
      key: `exp-${item.batchId}`,
      text:
        item.daysUntilExpiry < 0
          ? `${item.productName} · ${t('dashboard.expiredItem')}`
          : `${item.productName} · ${t('dashboard.expiringItem', { days: item.daysUntilExpiry })}`,
      to: '/expiry',
      tone: item.risk === 'expired' || item.risk === 'critical' ? 'danger' : 'warning',
    });
  }

  const stats = [
    {
      label: t('dashboard.totalProducts'),
      value: String(data.productCount),
      Icon: PackagePlus,
      tone: 'primary',
      to: '/products',
      a11y: t('a11y.lowStockLabel'),
    },
    {
      label: t('dashboard.lowStock'),
      value: String(data.lowStock.length),
      Icon: Gauge,
      tone: data.lowStock.length ? 'warning' : 'success',
      to: '/products?status=low',
      a11y: t('a11y.lowStockLabel'),
    },
    {
      label: t('dashboard.expiringSoon'),
      value: String(data.expiry.length),
      Icon: CalendarClock,
      tone: data.expiry.length ? 'danger' : 'success',
      to: '/expiry',
      a11y: t('a11y.expiryLabel'),
    },
    {
      label: t('dashboard.slowMoving'),
      value: String(slowOnly.length),
      Icon: Turtle,
      tone: slowOnly.length ? 'warning' : 'success',
      to: '/slow-moving',
      a11y: t('a11y.slowMovingLabel'),
    },
  ];

  const quickActions = [
    { to: '/sales/new', label: t('dashboard.recordSale'), Icon: ShoppingCart },
    { to: '/products/new', label: t('dashboard.addProduct'), Icon: Plus },
    { to: '/purchases/new', label: t('dashboard.receivePurchase'), Icon: PackagePlus },
    { to: '/restock', label: t('dashboard.createRestockPlan'), Icon: RefreshCcw },
  ];

  return (
    <>
      <PageHeader
        title={`${t(greetingKey)}${settings.shopName ? `, ${settings.shopName}` : ''}`}
        icon={<CategoryIcon category="other" />}
        actions={
          <>
            <span className="badge badge--neutral nowrap">
              {formatLongDate(todayISODate(), settings.language)}
            </span>
            {data.demoDataPresent ? <DemoBadge /> : null}
          </>
        }
      />

      <OfflineBanner />
      <SubNav />

      {/* Quick actions — biggest buttons, near the top on mobile */}
      <section className="section" aria-label={t('dashboard.quickActions')}>
        <div className="grid-cards">
          {quickActions.map(({ to, label, Icon }) => (            <Link
              key={to}
              to={to}
              className="btn btn--primary"
              style={{ flexDirection: 'column', minHeight: 88, gap: 6, textDecoration: 'none' }}
            >
              <Icon size={24} aria-hidden="true" />
              <span style={{ fontSize: 'var(--text-sm)' }}>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="section" aria-label={t('navigation.dashboard')}>
        <div className="grid-cards">
          {stats.map(({ label, value, Icon, tone, to }) => (
            <Link key={label} to={to} style={{ textDecoration: 'none' }}>
              <div className={`stat-card stat-card--${tone}`}>
                <span className="stat-card__icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="stat-card__value">{value}</span>
                <span className="stat-card__label">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Inventory value */}
      <section className="card section">
        <div className="card__title">
          {t('dashboard.inventoryValue')}
          <span className="badge badge--demo">{t('common.demoBadge')}</span>
        </div>
        <p className="stat-card__value">
          {data.inventoryValue != null
            ? formatMoney(data.inventoryValue, settings.language)
            : '—'}
        </p>
        <p className="text-xs muted">{t('dashboard.inventoryValueNote')}</p>
      </section>

      {/* Attention list */}
      <section className="card section" aria-labelledby="attention-heading">
        <div className="card__title" id="attention-heading">
          <span className="row" style={{ gap: 8 }}>
            <AlertTriangle size={18} aria-hidden="true" />
            {t('dashboard.attention')}
          </span>
        </div>
        {attention.length === 0 ? (
          <p className="muted text-sm">{t('dashboard.attentionEmpty')}</p>
        ) : (
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {attention.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className="list-row"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <span
                    className={`badge ${item.tone === 'danger' ? 'badge--out' : 'badge--low'}`}
                    aria-hidden="true"
                  >
                    <AlertTriangle size={13} />
                  </span>
                  <span className="list-row__main">
                    <span className="list-row__title" style={{ fontSize: 'var(--text-sm)' }}>
                      {item.text}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent sales */}
      <section className="card section" aria-labelledby="recent-sales-heading">
        <div className="card__title" id="recent-sales-heading">
          {t('dashboard.recentSales')}
          <Link to="/movements" className="text-sm">
            {t('dashboard.viewAll')}
          </Link>
        </div>
        {data.recentSales.length === 0 ? (
          <p className="muted text-sm">{t('dashboard.recentSalesEmpty')}</p>
        ) : (
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.recentSales.map((sale) => (
              <li key={sale.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title" style={{ fontSize: 'var(--text-sm)' }}>
                    {sale.items.map((i) => `${i.quantity} × ${i.productName}`).join(', ')}
                  </div>
                  <div className="list-row__meta">{sale.createdAt.slice(0, 10)}</div>
                </div>
                <div className="list-row__end">
                  <strong>{formatMoney(sale.totalAmount, settings.language)}</strong>
                  {sale.demo ? <DemoBadge /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs muted" style={{ textAlign: 'center' }}>
        {t('common.tagline')}
      </p>
    </>
  );
}

export default DashboardScreen;
